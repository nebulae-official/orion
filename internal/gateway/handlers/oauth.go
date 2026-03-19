package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/pkg/config"
)

const oauthStateTTL = 10 * time.Minute

// OAuthHandler handles OAuth authorization flows for GitHub and Google.
type OAuthHandler struct {
	cfg        config.Config
	rdb        *redis.Client
	httpClient HTTPClient
}

// NewOAuthHandler creates an OAuthHandler.
func NewOAuthHandler(cfg config.Config, rdb *redis.Client) *OAuthHandler {
	return &OAuthHandler{
		cfg:        cfg,
		rdb:        rdb,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// NewOAuthHandlerWithClient creates an OAuthHandler with a custom HTTP client (for testing).
func NewOAuthHandlerWithClient(cfg config.Config, rdb *redis.Client, client HTTPClient) *OAuthHandler {
	return &OAuthHandler{
		cfg:        cfg,
		rdb:        rdb,
		httpClient: client,
	}
}

// oauthStateData is stored in Redis keyed by the OAuth state parameter.
type oauthStateData struct {
	Redirect string `json:"redirect"`
	Provider string `json:"provider"`
}

// oauthLinkRequest is sent to the identity service to link an OAuth account.
type oauthLinkRequest struct {
	Provider       string `json:"provider"`
	ProviderUserID string `json:"provider_user_id"`
	ProviderEmail  string `json:"provider_email"`
	Name           string `json:"name"`
	AvatarURL      string `json:"avatar_url"`
	AccessToken    string `json:"access_token"`
	RefreshToken   string `json:"refresh_token,omitempty"`
}

// oauthLinkResponse is the response from the identity service after linking.
type oauthLinkResponse struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	Role         string `json:"role"`
	RefreshToken string `json:"refresh_token"`
}

// githubAccessTokenResponse is what GitHub returns when exchanging a code.
type githubAccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

// githubUser is a subset of the GitHub user API response.
type githubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

// githubEmail is a single entry from the GitHub /user/emails endpoint.
type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// googleTokenResponse is what Google returns when exchanging a code.
type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// googleUserInfo is the user info from the Google userinfo endpoint.
type googleUserInfo struct {
	Sub       string `json:"sub"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Picture   string `json:"picture"`
	Verified  bool   `json:"email_verified"`
}

// ---------- GitHub OAuth ----------

// GitHubInitiate handles GET /api/v1/auth/oauth/github.
func (h *OAuthHandler) GitHubInitiate() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.cfg.GitHubClientID == "" {
			writeJSON(w, http.StatusNotImplemented, map[string]string{"message": "GitHub OAuth not configured"})
			return
		}

		if h.rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "OAuth requires Redis"})
			return
		}

		state := uuid.New().String()

		redirect := r.URL.Query().Get("redirect")
		if redirect == "" {
			redirect = h.cfg.OAuthRedirectBase
		}

		stateData := oauthStateData{Redirect: redirect, Provider: "github"}
		data, _ := json.Marshal(stateData)

		key := fmt.Sprintf("oauth:state:%s", state)
		if err := h.rdb.Set(r.Context(), key, string(data), oauthStateTTL).Err(); err != nil {
			slog.Error("storing oauth state", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		callbackURL := fmt.Sprintf("%s/api/v1/auth/oauth/github/callback", h.cfg.OAuthRedirectBase)
		authURL := fmt.Sprintf(
			"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=user:email&state=%s",
			url.QueryEscape(h.cfg.GitHubClientID),
			url.QueryEscape(callbackURL),
			url.QueryEscape(state),
		)

		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// GitHubCallback handles GET /api/v1/auth/oauth/github/callback.
func (h *OAuthHandler) GitHubCallback() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		state := r.URL.Query().Get("state")
		code := r.URL.Query().Get("code")

		if state == "" || code == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "missing state or code"})
			return
		}

		if h.rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "OAuth requires Redis"})
			return
		}

		// Verify and consume state.
		stateKey := fmt.Sprintf("oauth:state:%s", state)
		stateVal, err := h.rdb.GetDel(r.Context(), stateKey).Result()
		if err != nil {
			slog.Warn("oauth state not found", "state", state, "error", err)
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid or expired state"})
			return
		}

		var stateData oauthStateData
		if err := json.Unmarshal([]byte(stateVal), &stateData); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		// Exchange code for access token.
		tokenReqBody, _ := json.Marshal(map[string]string{
			"client_id":     h.cfg.GitHubClientID,
			"client_secret": h.cfg.GitHubClientSecret,
			"code":          code,
		})
		tokenReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://github.com/login/oauth/access_token", bytes.NewReader(tokenReqBody))
		tokenReq.Header.Set("Content-Type", "application/json")
		tokenReq.Header.Set("Accept", "application/json")

		tokenResp, err := h.httpClient.Do(tokenReq)
		if err != nil {
			slog.Error("github token exchange failed", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "GitHub token exchange failed"})
			return
		}
		defer tokenResp.Body.Close()

		var ghToken githubAccessTokenResponse
		if err := json.NewDecoder(tokenResp.Body).Decode(&ghToken); err != nil || ghToken.AccessToken == "" {
			slog.Error("github token response invalid", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "GitHub token exchange failed"})
			return
		}

		// Fetch GitHub user profile.
		userReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://api.github.com/user", nil)
		userReq.Header.Set("Authorization", "Bearer "+ghToken.AccessToken)
		userReq.Header.Set("Accept", "application/json")

		userResp, err := h.httpClient.Do(userReq)
		if err != nil {
			slog.Error("github user fetch failed", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "GitHub user fetch failed"})
			return
		}
		defer userResp.Body.Close()

		var ghUser githubUser
		if err := json.NewDecoder(userResp.Body).Decode(&ghUser); err != nil {
			slog.Error("github user response invalid", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "GitHub user fetch failed"})
			return
		}

		// Fetch primary email if not present on user profile.
		email := ghUser.Email
		if email == "" {
			emailReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://api.github.com/user/emails", nil)
			emailReq.Header.Set("Authorization", "Bearer "+ghToken.AccessToken)
			emailReq.Header.Set("Accept", "application/json")

			emailResp, err := h.httpClient.Do(emailReq)
			if err == nil {
				defer emailResp.Body.Close()
				var emails []githubEmail
				if err := json.NewDecoder(emailResp.Body).Decode(&emails); err == nil {
					for _, e := range emails {
						if e.Primary && e.Verified {
							email = e.Email
							break
						}
					}
				}
			}
		}

		name := ghUser.Name
		if name == "" {
			name = ghUser.Login
		}

		// Link with identity service.
		linkReq := oauthLinkRequest{
			Provider:       "github",
			ProviderUserID: fmt.Sprintf("%d", ghUser.ID),
			ProviderEmail:  email,
			Name:           name,
			AvatarURL:      ghUser.AvatarURL,
			AccessToken:    ghToken.AccessToken,
		}

		linkUser, err := h.linkOAuthAccount(r, linkReq)
		if err != nil {
			slog.Error("oauth link failed", "error", err)
			redirectWithError(w, r, stateData.Redirect, "OAuth account linking failed")
			return
		}

		// Generate JWT and redirect.
		h.completeOAuthLogin(w, r, linkUser, stateData.Redirect)
	}
}

// ---------- Google OAuth ----------

// GoogleInitiate handles GET /api/v1/auth/oauth/google.
func (h *OAuthHandler) GoogleInitiate() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.cfg.GoogleClientID == "" {
			writeJSON(w, http.StatusNotImplemented, map[string]string{"message": "Google OAuth not configured"})
			return
		}

		if h.rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "OAuth requires Redis"})
			return
		}

		state := uuid.New().String()

		redirect := r.URL.Query().Get("redirect")
		if redirect == "" {
			redirect = h.cfg.OAuthRedirectBase
		}

		stateData := oauthStateData{Redirect: redirect, Provider: "google"}
		data, _ := json.Marshal(stateData)

		key := fmt.Sprintf("oauth:state:%s", state)
		if err := h.rdb.Set(r.Context(), key, string(data), oauthStateTTL).Err(); err != nil {
			slog.Error("storing oauth state", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		callbackURL := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.cfg.OAuthRedirectBase)
		authURL := fmt.Sprintf(
			"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid+email+profile&state=%s",
			url.QueryEscape(h.cfg.GoogleClientID),
			url.QueryEscape(callbackURL),
			url.QueryEscape(state),
		)

		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// GoogleCallback handles GET /api/v1/auth/oauth/google/callback.
func (h *OAuthHandler) GoogleCallback() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		state := r.URL.Query().Get("state")
		code := r.URL.Query().Get("code")

		if state == "" || code == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "missing state or code"})
			return
		}

		if h.rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "OAuth requires Redis"})
			return
		}

		// Verify and consume state.
		stateKey := fmt.Sprintf("oauth:state:%s", state)
		stateVal, err := h.rdb.GetDel(r.Context(), stateKey).Result()
		if err != nil {
			slog.Warn("oauth state not found", "state", state, "error", err)
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid or expired state"})
			return
		}

		var stateData oauthStateData
		if err := json.Unmarshal([]byte(stateVal), &stateData); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		// Exchange code for tokens.
		callbackURL := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.cfg.OAuthRedirectBase)
		tokenData := url.Values{
			"client_id":     {h.cfg.GoogleClientID},
			"client_secret": {h.cfg.GoogleClientSecret},
			"code":          {code},
			"grant_type":    {"authorization_code"},
			"redirect_uri":  {callbackURL},
		}
		tokenReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://oauth2.googleapis.com/token", bytes.NewReader([]byte(tokenData.Encode())))
		tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		tokenResp, err := h.httpClient.Do(tokenReq)
		if err != nil {
			slog.Error("google token exchange failed", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "Google token exchange failed"})
			return
		}
		defer tokenResp.Body.Close()

		var gToken googleTokenResponse
		if err := json.NewDecoder(tokenResp.Body).Decode(&gToken); err != nil || gToken.AccessToken == "" {
			slog.Error("google token response invalid", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "Google token exchange failed"})
			return
		}

		// Fetch user info from Google.
		userReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
		userReq.Header.Set("Authorization", "Bearer "+gToken.AccessToken)

		userResp, err := h.httpClient.Do(userReq)
		if err != nil {
			slog.Error("google userinfo fetch failed", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "Google user info fetch failed"})
			return
		}
		defer userResp.Body.Close()

		var gUser googleUserInfo
		if err := json.NewDecoder(userResp.Body).Decode(&gUser); err != nil {
			slog.Error("google userinfo response invalid", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "Google user info fetch failed"})
			return
		}

		// Link with identity service.
		linkReq := oauthLinkRequest{
			Provider:       "google",
			ProviderUserID: gUser.Sub,
			ProviderEmail:  gUser.Email,
			Name:           gUser.Name,
			AvatarURL:      gUser.Picture,
			AccessToken:    gToken.AccessToken,
			RefreshToken:   gToken.RefreshToken,
		}

		linkUser, err := h.linkOAuthAccount(r, linkReq)
		if err != nil {
			slog.Error("oauth link failed", "error", err)
			redirectWithError(w, r, stateData.Redirect, "OAuth account linking failed")
			return
		}

		h.completeOAuthLogin(w, r, linkUser, stateData.Redirect)
	}
}

// ---------- Helpers ----------

// linkOAuthAccount calls the identity service to link or create an OAuth account.
func (h *OAuthHandler) linkOAuthAccount(r *http.Request, linkReq oauthLinkRequest) (*oauthLinkResponse, error) {
	body, _ := json.Marshal(linkReq)

	idReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.cfg.IdentityURL+"/internal/users/oauth/link", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating identity request: %w", err)
	}
	idReq.Header.Set("Content-Type", "application/json")

	idResp, err := h.httpClient.Do(idReq)
	if err != nil {
		return nil, fmt.Errorf("identity service unreachable: %w", err)
	}
	defer idResp.Body.Close()

	if idResp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(idResp.Body, 1024))
		return nil, fmt.Errorf("identity service returned %d: %s", idResp.StatusCode, string(respBody))
	}

	var linkUser oauthLinkResponse
	if err := json.NewDecoder(idResp.Body).Decode(&linkUser); err != nil {
		return nil, fmt.Errorf("decoding identity response: %w", err)
	}

	return &linkUser, nil
}

// completeOAuthLogin generates a JWT and redirects the user with cookies set.
func (h *OAuthHandler) completeOAuthLogin(w http.ResponseWriter, r *http.Request, user *oauthLinkResponse, redirectURL string) {
	tokenStr, _, err := (&AuthHandler{cfg: h.cfg}).generateToken(user.UserID, user.Email, user.Name, user.Role)
	if err != nil {
		slog.Error("oauth token generation failed", "error", err)
		redirectWithError(w, r, redirectURL, "token generation failed")
		return
	}

	// Set cookies for the dashboard.
	secure := !h.cfg.IsDevelopment()

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    tokenStr,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(tokenExpiry.Seconds()),
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    user.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600, // 7 days
	})

	// Redirect to the originally requested URL.
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		redirectURL = h.cfg.OAuthRedirectBase
		parsed, _ = url.Parse(redirectURL)
	}

	q := parsed.Query()
	q.Set("oauth", "success")
	parsed.RawQuery = q.Encode()

	http.Redirect(w, r, parsed.String(), http.StatusTemporaryRedirect)
}

// redirectWithError redirects to the given URL with an error query parameter.
func redirectWithError(w http.ResponseWriter, r *http.Request, redirectURL, message string) {
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": message})
		return
	}

	q := parsed.Query()
	q.Set("error", message)
	parsed.RawQuery = q.Encode()

	http.Redirect(w, r, parsed.String(), http.StatusTemporaryRedirect)
}
