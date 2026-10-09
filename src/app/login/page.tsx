import { LoginForm } from "./login-form";
import { isConfigured } from "@/lib/config";
import { ConnectionNotice } from "@/components/connection-notice";
export default function Login() {
  return <><h1>이메일로 시작하기</h1>{isConfigured() ? <LoginForm /> : <ConnectionNotice />}</>;
}
