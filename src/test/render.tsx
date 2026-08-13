import type { ReactElement } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { jaJP } from "@mui/x-date-pickers/locales";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { render } from "@testing-library/react";
import "dayjs/locale/ja";
import { theme } from "../theme";

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>,
  );
}

export function renderWithDatePickers(ui: ReactElement) {
  return renderWithProviders(
    <LocalizationProvider
      adapterLocale="ja"
      dateAdapter={AdapterDayjs}
      localeText={jaJP.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      {ui}
    </LocalizationProvider>,
  );
}
