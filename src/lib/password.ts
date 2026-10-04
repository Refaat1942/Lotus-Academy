export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Password must include letters and numbers.";
  if (pw.length > 128) return "Password is too long.";
  return null;
}
