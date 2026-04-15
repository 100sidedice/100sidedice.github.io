export function formatLargeNumber(num, threshold = 10) {
  // Check if the number (as an integer) exceeds the threshold
  if (Math.abs(num).toString().split('.')[0].length > threshold) {
    return num.toExponential(2);
  }
  return num.toString();
}