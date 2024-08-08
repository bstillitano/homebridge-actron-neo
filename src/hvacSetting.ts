export class HvacSetting {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  constructor(
    readonly settingId: string,
    readonly settingName: string,
    readonly settingType: string,
  ) {
    this.id = settingId;
    this.name = settingName;
    this.type = settingType;
  }
}