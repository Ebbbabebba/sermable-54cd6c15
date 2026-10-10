import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("s-mv s-nw", className)}
      classNames={{
        months: "s-c5 s-c7 s-rj s-t1 s-sf s-sg",
        month: "s-t1",
        caption: "s-c5 s-ig s-o7 s-pd s-ib",
        caption_label: "s-v9 s-d0",
        nav: "s-ss s-c5 s-ib",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "s-g4 s-xy s-61 s-mr s-mg s-hn",
        ),
        nav_button_previous: "s-26 s-it",
        nav_button_next: "s-26 s-pf",
        table: "s-y7 s-72 s-sw",
        head_row: "flex",
        head_cell: "s-ul s-qi s-y2 s-d2 s-tk",
        row: "s-c5 s-y7 s-lv",
        cell: "s-g8 s-y2 s-u0 s-v9 s-mr s-pd s-f s-e s-d s-c1 s-ij s-cl s-cm",
        day: cn(buttonVariants({ variant: "ghost" }), "s-g8 s-y2 s-mr s-d2 s-37"),
        day_range_end: "day-range-end",
        day_selected:
          "s-5c s-ux s-h3 s-hx s-co s-cv",
        day_today: "s-3p s-tr",
        day_outside:
          "day-outside s-ul s-mg s-36 s-3a s-38",
        day_disabled: "s-ul s-mg",
        day_range_middle: "s-35 s-39",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="s-fz s-xt" />,
        IconRight: ({ ..._props }) => <ChevronRight className="s-fz s-xt" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
