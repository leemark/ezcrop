const MAX_OUTPUT_DIMENSION = 7680;

export function assertValidOutputDimensions(
  width: number,
  height: number,
): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_OUTPUT_DIMENSION ||
    height > MAX_OUTPUT_DIMENSION
  ) {
    throw new Error("Width and height must be whole numbers from 1 to 7680 pixels.");
  }
}
