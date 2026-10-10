import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster s-e5"
      toastOptions={{
        classNames: {
          toast:
            "s-e5 toast s-ej s-em s-ek s-el",
          description: "s-eh",
          actionButton: "s-eg s-ei",
          cancelButton: "s-ef s-eh",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
