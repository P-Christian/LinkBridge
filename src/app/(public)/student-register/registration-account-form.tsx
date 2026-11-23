"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validatePasswordStrict } from "@/lib/password-validation";

import { COUNTRIES, type CountryData } from "./country-data";
import { PhoneCountryPicker } from "./phone-country-picker";

export type StudentAccountInput = {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly fullContact: string;
  readonly country: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly turnstileToken: string;
};

type RegistrationAccountFormProps = {
  readonly schoolName: string;
  readonly studentFirstName: string;
  readonly studentLastName: string;
  readonly rosterEmailMasked: string;
  readonly loginHref: string;
  readonly busy: boolean;
  readonly submissionError: string | null;
  readonly onBack: () => void;
  readonly onSubmit: (input: StudentAccountInput) => Promise<boolean>;
};

function maskedEmailPattern(masked: string): RegExp | null {
  const escaped = masked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
  try {
    return new RegExp(`^${escaped}$`, "i");
  } catch {
    return null;
  }
}

export function RegistrationAccountForm(props: RegistrationAccountFormProps) {
  const [firstName, setFirstName] = useState(props.studentFirstName);
  const [lastName, setLastName] = useState(props.studentLastName);
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState<CountryData>(COUNTRIES[0]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const rosterPattern = useMemo(() => maskedEmailPattern(props.rosterEmailMasked), [props.rosterEmailMasked]);
  const showDurabilityWarning = Boolean(email.trim() && rosterPattern?.test(email.trim()));
  const clearError = (field: string) => setErrors((current) => current[field] ? { ...current, [field]: "" } : current);
  const confirmMismatchMessage = (pw: string, confirm: string): string =>
    confirm && confirm !== pw ? "Passwords do not match." : "";
  const isConfirmMismatchError = (value: string | undefined): boolean =>
    value === "Passwords do not match." || value === "Passwords do not match";
  const syncConfirmMismatch = (pw: string, confirm: string) => {
    const message = confirmMismatchMessage(pw, confirm);
    setErrors((current) => {
      if (message) return current.confirmPassword === message ? current : { ...current, confirmPassword: message };
      if (isConfirmMismatchError(current.confirmPassword)) return { ...current, confirmPassword: "" };
      return current;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setConfirmTouched(true);
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
    if (!email.trim()) next.email = "Email address is required";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Please enter a valid email address";
    const digits = contact.replace(/\D/g, "");
    if (!contact.trim()) next.contact = "Mobile number is required";
    else if (![`${country.dialCode} ${contact.trim()}`, contact.trim(), `${country.dialCode} ${digits}`, digits].some((value) => country.regex.test(value))) {
      next.contact = `Invalid format for ${country.name}. Example: ${country.dialCode} ${country.example}`;
    }
    if (!password) next.password = "Password is required";
    else if (!validatePasswordStrict(password)) next.password = "Password does not meet security requirements";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password) next.confirmPassword = "Passwords do not match.";
    if (!termsAgreed) next.terms = "You must agree to the Terms of Service to continue";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const initiated = await props.onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      fullContact: `${country.dialCode}${digits.replace(/^0/, "")}`,
      country: country.name,
      password,
      confirmPassword,
      turnstileToken,
    });
    if (initiated) {
      setPassword("");
      setConfirmPassword("");
      setTurnstileToken("");
      setConfirmTouched(false);
      setSubmitAttempted(false);
    }
  };

  const fieldClass = "h-12 border-2 border-border focus-visible:ring-0 focus-visible:border-primary";
  return (
    <div className="w-full max-w-[600px] mx-auto px-4 sm:px-6 pt-2 pb-6 md:py-12">
      <Button type="button" variant="ghost" onClick={props.onBack} className="mb-6 min-h-11 px-0 text-muted-foreground hover:text-primary"><ArrowLeft aria-hidden="true" />Back to invitation</Button>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-medium text-primary">Create your Job Seeker account</h1>
        <p className="mt-3 text-muted-foreground">Finish setting up your account to link it to {props.schoolName}.</p>
      </div>
      <form className="space-y-6" onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="sr-firstName" label="First name" value={firstName} error={errors.firstName} autoComplete="given-name" onChange={(value) => { setFirstName(value); clearError("firstName"); }} />
          <Field id="sr-lastName" label="Last name" value={lastName} error={errors.lastName} autoComplete="family-name" onChange={(value) => { setLastName(value); clearError("lastName"); }} />
        </div>
        <div className="space-y-1">
          <label htmlFor="sr-email" className="block text-sm font-medium">Email address <span className="text-destructive">*</span></label>
          <Input id="sr-email" type="email" value={email} autoComplete="email" disabled={props.busy} aria-invalid={Boolean(errors.email)} aria-describedby="sr-email-help" onChange={(event) => { setEmail(event.target.value); clearError("email"); }} className={cn(fieldClass, errors.email && "border-destructive")} />
          {errors.email ? <p id="sr-email-help" role="alert" className="text-xs text-destructive font-medium">{errors.email}</p> : <p id="sr-email-help" className="text-xs text-muted-foreground">Use a personal email you&apos;ll keep after graduation.</p>}
          {showDurabilityWarning && <div role="alert" className="mt-2 rounded-xl bg-warning-bg border border-warning/30 p-4 text-xs leading-relaxed"><p className="font-semibold text-warning mb-1">Consider a long-term personal email</p><p className="text-muted-foreground">If this address is school-issued, the mailbox may be deactivated after graduation, which could affect sign-in and recovery. You may continue, but a personal email is safer.</p></div>}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">After you continue, the server will compare your signed-in email with the school email on the invitation. A second verification code is sent only if those emails differ.</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="sr-contact" className="block text-sm font-medium">Mobile number <span className="text-destructive">*</span></label>
          <PhoneCountryPicker inputId="sr-contact" selectedCountry={country} onSelectCountry={(value) => { setCountry(value); clearError("contact"); }} phoneValue={contact} onPhoneChange={(value) => { setContact(value); clearError("contact"); }} error={errors.contact} disabled={props.busy} />
          {errors.contact && <p id="sr-contact-error" role="alert" className="text-xs text-destructive font-medium">{errors.contact}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <PasswordField id="sr-password" label="Password" value={password} visible={showPassword} error={errors.password} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => { setPassword(value); clearError("password"); if (confirmTouched || submitAttempted) syncConfirmMismatch(value, confirmPassword); }} />
            <PasswordField id="sr-confirmPassword" label="Confirm password" value={confirmPassword} visible={showConfirmation} error={errors.confirmPassword} onToggle={() => setShowConfirmation((value) => !value)} onChange={(value) => { setConfirmPassword(value); setConfirmTouched(true); syncConfirmMismatch(password, value); }} onBlur={() => { setConfirmTouched(true); syncConfirmMismatch(password, confirmPassword); }} />
          </div>
          <PasswordRequirementsChecklist password={password} confirmPassword={confirmPassword} className="mt-1" />
        </div>
        <label className="flex min-h-11 items-start gap-3 cursor-pointer"><Checkbox checked={termsAgreed} onCheckedChange={(value) => { setTermsAgreed(Boolean(value)); clearError("terms"); }} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "sr-terms-error" : undefined} className={cn("mt-0.5", errors.terms && "border-destructive")} /><span className={cn("text-sm text-muted-foreground", errors.terms && "text-destructive")}>I agree to the <Link href="/terms-of-service" target="_blank" className="text-primary font-medium hover:underline">Terms of Service</Link> and <Link href="/privacy-policy" target="_blank" className="text-primary font-medium hover:underline">Privacy Policy</Link>.</span></label>
        {errors.terms && <p id="sr-terms-error" role="alert" className="text-xs text-destructive font-medium">{errors.terms}</p>}
        <div className="rounded-xl border border-border bg-muted/20 p-4"><TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} /></div>
        {!turnstileToken && <p id="sr-security-help" className="text-center text-xs text-muted-foreground">Complete the security check to enable account creation.</p>}
        {props.submissionError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-xs font-medium text-destructive">{props.submissionError}</p>}
        <Button type="submit" disabled={props.busy || !termsAgreed || !turnstileToken} aria-describedby={!turnstileToken ? "sr-security-help" : undefined} className="min-h-11 w-full py-6 rounded-full text-lg">{props.busy ? "Creating..." : "Create account"}</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">Already have an account? <Link href={props.loginHref} className="inline-flex min-h-11 items-center text-primary font-medium hover:underline">Sign in</Link></p>
    </div>
  );
}

function Field({ id, label, value, error, autoComplete, onChange }: { readonly id: string; readonly label: string; readonly value: string; readonly error?: string; readonly autoComplete: string; readonly onChange: (value: string) => void }) {
  return <div className="space-y-1"><label htmlFor={id} className="block text-sm font-medium">{label} <span className="text-destructive">*</span></label><Input id={id} value={value} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className={cn("h-12 border-2 border-border focus-visible:ring-0 focus-visible:border-primary", error && "border-destructive")} />{error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive font-medium">{error}</p>}</div>;
}

function PasswordField({ id, label, value, visible, error, onToggle, onChange, onBlur }: { readonly id: string; readonly label: string; readonly value: string; readonly visible: boolean; readonly error?: string; readonly onToggle: () => void; readonly onChange: (value: string) => void; readonly onBlur?: () => void }) {
  const errorId = `${id}-error`;
  return <div className="space-y-1"><label htmlFor={id} className="block text-sm font-medium">{label} <span className="text-destructive">*</span></label><div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} autoComplete="new-password" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className={cn("h-12 pr-12 border-2 border-border focus-visible:ring-0 focus-visible:border-primary", error && "border-destructive")} /><button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div>{error && <p id={errorId} role="alert" className="text-xs text-destructive font-medium">{error}</p>}</div>;
}
