export type KioskPunchAction = "checkIn" | "checkOut";

export type KioskPunchResult = {
  displayName: string;
  action: KioskPunchAction;
  atUtc: string;
  message?: string | null;
};

