export class HvacSetting {
  readonly id: string;
  readonly name: string;

  constructor(
    readonly settingId: string,
    readonly settingName: string,
  ) {
    this.id = settingId;
    this.name = settingName;
  }
}