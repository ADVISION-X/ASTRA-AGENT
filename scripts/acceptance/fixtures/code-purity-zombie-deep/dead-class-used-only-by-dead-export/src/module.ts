export const live = () => 1;

export const deadExport = () => new DeadClass().run();

class DeadClass {
  run(): number {
    return 2;
  }
}