import { redirect } from "next/navigation";

export default function GenerationPage(): never {
  redirect("/generation/pipeline");
}
