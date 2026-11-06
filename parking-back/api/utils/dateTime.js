function getBangkokDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  return {
    date_add: `${value("year")}-${value("month")}-${value("day")}`,
    time_add: `${value("hour")}:${value("minute")}:${value("second")}`,
  };
}

module.exports = { getBangkokDateTime };
