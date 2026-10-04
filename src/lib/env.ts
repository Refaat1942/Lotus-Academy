export const env = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:15169",
  secure: () => (process.env.APP_URL ?? "").startsWith("https://"),
  smtp: () => ({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "Lotus Academy <no-reply@localhost>",
  }),
};
