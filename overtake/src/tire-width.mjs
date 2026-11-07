// Narrow tires steer more quickly with less lateral grip; wide tires grip
// better but add rolling load and slow steering response. Factory is neutral.
export function tireWidthHandling(width) {
  if (width === 'narrow') return { grip: .93, accel: 1.02, steer: 1.08 };
  if (width === 'wide') return { grip: 1.08, accel: .97, steer: .92 };
  return { grip: 1, accel: 1, steer: 1 };
}
