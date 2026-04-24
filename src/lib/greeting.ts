export function resolveDayPeriodGreeting(date = new Date()) {
  return date.getHours() < 12 ? "Bom dia" : "Boa noite";
}
