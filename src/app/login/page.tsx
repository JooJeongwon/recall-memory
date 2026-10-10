import { LoginForm } from "./login-form";
import { isConfigured } from "@/lib/config";
import { ConnectionNotice } from "@/components/connection-notice";
export default async function Login(props: PageProps<"/login">) {
  const authError = (await props.searchParams).error === "oauth";
  return <><h1>Google로 로그인</h1>{isConfigured() ? <LoginForm authError={authError} /> : <ConnectionNotice />}</>;
}
