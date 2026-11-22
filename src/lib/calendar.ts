import * as Calendar from "expo-calendar";

export async function addGigToCalendar(params: {
  title: string;
  location: string;
  date: string; // YYYY-MM-DD
}) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Allow WeGig to access your calendar in your phone settings, then try again.");
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );

  const calendar = calendars.find((c) => c.allowsModifications);

  if (!calendar) {
    throw new Error("No writable calendar is available on this phone.");
  }

  const startDate = new Date(`${params.date}T19:00:00`);
  const endDate = new Date(`${params.date}T23:00:00`);

  await Calendar.createEventAsync(calendar.id, {
    title: params.title,
    location: params.location,
    startDate,
    endDate,
    timeZone: "UTC",
  });
}