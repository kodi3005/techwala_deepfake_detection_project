import { redirect } from "next/navigation";

export default function AuthCodeErrorPage() {
  redirect("/login");
}
