
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function numToChar(num) {
  if (num < 26) return String.fromCharCode(num + 'a'.charCodeAt(0));
  if (num < 52) return String.fromCharCode(num - 26 + 'A'.charCodeAt(0));
  return "x";
}

export function getRandomId() {
  let x = getRandomInt(0, 2147483647);
  //console.log(x);
  let res = [numToChar(x % 52)];
  x /= 52;
  res.unshift(String.fromCharCode((x % 10) + '0'.charCodeAt(0)));
  x /= 10;
  res.unshift(numToChar(x % 52));
  x /= 52;
  res.unshift(numToChar(x % 52));
  x /= 52;
  res.unshift(String.fromCharCode((x % 10) + '0'.charCodeAt(0)));
  x /= 10;
  res.unshift(String.fromCharCode((x % 10) + '0'.charCodeAt(0)));
  x /= 10;
  res.unshift(numToChar(x % 52));
  x /= 52;
  return res.join("");
}