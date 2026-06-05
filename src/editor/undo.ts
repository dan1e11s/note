export interface Snapshot {
  text: string;
  caret: number;
}

const HISTORY_LIMIT = 200;

export class History {
  private readonly past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private present: Snapshot;

  constructor(initial: Snapshot) {
    this.present = initial;
  }

  record(snapshot: Snapshot): void {
    if (snapshot.text === this.present.text) {
      this.present = snapshot;
      return;
    }
    this.past.push(this.present);
    if (this.past.length > HISTORY_LIMIT) {
      this.past.shift();
    }
    this.present = snapshot;
    this.future = [];
  }

  undo(): Snapshot | null {
    const previous = this.past.pop();
    if (previous === undefined) {
      return null;
    }
    this.future.push(this.present);
    this.present = previous;
    return previous;
  }

  redo(): Snapshot | null {
    const next = this.future.pop();
    if (next === undefined) {
      return null;
    }
    this.past.push(this.present);
    this.present = next;
    return next;
  }
}
