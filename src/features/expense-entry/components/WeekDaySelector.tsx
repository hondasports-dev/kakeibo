import { Box } from "@mui/material";
import { generateWeekDays } from "../../week";

export function WeekDaySelector({
  weekStartDate,
  weekEndDate,
  selectedDate,
  onSelectDate,
}: {
  weekStartDate: string;
  weekEndDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const weekDays = generateWeekDays(weekStartDate, weekEndDate);

  return (
    <Box className="week-day-grid" aria-label="週内の日付候補" role="listbox">
      {weekDays.map((day) => {
        const isSelected = selectedDate === day.isoDate;
        return (
          <Box
            aria-label={`${day.label}曜日 ${day.date}${isSelected ? " 選択中" : ""}`}
            aria-selected={isSelected}
            className="week-day-button"
            key={day.isoDate}
            onClick={() => onSelectDate(day.isoDate)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectDate(day.isoDate);
              }
            }}
            role="option"
            tabIndex={0}
            sx={{
              border: "1px solid",
              borderColor: isSelected ? "primary.main" : "divider",
              borderRadius: 1,
              bgcolor: isSelected ? "primary.main" : "background.paper",
              color: isSelected ? "primary.contrastText" : "text.primary",
              px: 1,
              py: 1,
              textAlign: "center",
              cursor: "pointer",
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "2px",
              },
            }}
          >
            <span>{day.label}</span>
            <small>{day.date}</small>
          </Box>
        );
      })}
    </Box>
  );
}
