export class Layer {
  protected TID: string;

  constructor(TID: string) {
    this.TID = TID;
  }

  protected generateStoreKey(key) {
    return `${this.TID}-${key}`;
  }
}
