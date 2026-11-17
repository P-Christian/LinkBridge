// import React from 'react';
import { Check, Circle, X } from 'lucide-react';
import { checkPasswordRequirements } from '@/lib/password-validation';
import { cn } from '@/lib/utils';

interface PasswordRequirementsChecklistProps {
  password: string;
  confirmPassword?: string;
  className?: string;
  showTitle?: boolean;
}

export function PasswordRequirementsChecklist({
  password,
  confirmPassword,
  className,
  showTitle = true,
}: PasswordRequirementsChecklistProps) {
  const reqs = checkPasswordRequirements(password);
  // const isMatchOk = confirmPassword === undefined || (Boolean(confirmPassword) && confirmPassword === password);
  // const isValid = validatePasswordStrict(password) && isMatchOk;
  const mismatch =
    confirmPassword !== undefined && confirmPassword.length > 0 && confirmPassword !== password;

  type ChecklistItem = { readonly label: string; readonly met: boolean; readonly isMatchRow?: boolean };
  const items: ChecklistItem[] = [
    { label: 'At least 8 characters', met: reqs.minLength },
    { label: 'One uppercase letter (A–Z)', met: reqs.uppercase },
    { label: 'One lowercase letter (a–z)', met: reqs.lowercase },
    { label: 'One number (0–9)', met: reqs.number },
    { label: 'One special character (!@#$%^&* etc.)', met: reqs.special },
  ];

  if (confirmPassword !== undefined) {
    items.push({
      label: 'Passwords match',
      met: Boolean(confirmPassword) && confirmPassword === password,
      isMatchRow: true,
    });
  }

  return (
    <div className={cn("p-3.5 rounded-xl bg-muted/40 !mt-5 border border-border/80 text-xs space-y-2 transition-all", mismatch && "border-destructive/40", className)}>
      {showTitle && (
        <p className="font-semibold text-muted-foreground text-[9px] uppercase tracking-wider mb-1">
          Your password must contain:
        </p>
      )}
      <ul className=" ">
        {items.map((item, index) => (
          <li
            key={index}
            className={cn(
              "flex items-center gap-2 transition-colors duration-150 font-medium" ,
              item.isMatchRow && mismatch ? "text-destructive font-semibold" : item.met ? "text-emerald-600 dark:text-emerald-400 font-semibold " : "text-muted-foreground/70"
            )}
          >
            {item.isMatchRow && mismatch ? (
              <span className="w-2 h-2 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <X className="w-2 h-2 text-destructive stroke-[3]" />
              </span>
            ) : item.met ? (
              <span className="w-2 h-2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                <Check className="w-2 h-2 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full flex items-center justify-center shrink-0">
                <Circle className="w-2 h-2 text-muted-foreground/30 fill-muted-foreground/20" />
              </span>
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {/* {isValid && (
        <div className="mt-2 pt-1.5 border-t border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
          <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
          <span>Password meets all security requirements.</span>
        </div>
      )} */}
    </div>
  );
}

export default PasswordRequirementsChecklist;
