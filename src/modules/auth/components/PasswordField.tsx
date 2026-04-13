import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function PasswordField(props: PasswordFieldProps) {
  const { className, ...rest } = props;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...rest}
        type={visible ? "text" : "password"}
        className={cn("h-12 rounded-2xl border-white/8 bg-[#101924] pr-12 text-sm text-slate-100 placeholder:text-slate-500", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-10 w-10 rounded-xl text-slate-500 hover:bg-transparent hover:text-slate-300"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </Button>
    </div>
  );
}
