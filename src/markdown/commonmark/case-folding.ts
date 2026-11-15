// Unicode's `CaseFolding.txt` (vendored at `spec/unicode/`), the common (C) and full (F) mappings that CommonMark
// folds a link label by. The Turkic (T) and simple (S) mappings stay out: the full ones supersede the simple.
// A common run reads `first:count:stride:delta` in hex: `count` code points from `first`, `stride` apart, each
// folding to its own plus `delta`. A full folding reads `code point=code points` in hex.
const commonRuns =
  '41:1a:1:+20 b5:1:1:+307 c0:17:1:+20 d8:7:1:+20 100:18:2:+1 132:3:2:+1 139:8:2:+1 14a:17:2:+1 178:1:1:-79\
  179:3:2:+1 17f:1:1:-10c 181:1:1:+d2 182:2:2:+1 186:1:1:+ce 187:1:1:+1 189:2:1:+cd 18b:1:1:+1 18e:1:1:+4f\
  18f:1:1:+ca 190:1:1:+cb 191:1:1:+1 193:1:1:+cd 194:1:1:+cf 196:1:1:+d3 197:1:1:+d1 198:1:1:+1 19c:1:1:+d3\
  19d:1:1:+d5 19f:1:1:+d6 1a0:3:2:+1 1a6:1:1:+da 1a7:1:1:+1 1a9:1:1:+da 1ac:1:1:+1 1ae:1:1:+da 1af:1:1:+1\
  1b1:2:1:+d9 1b3:2:2:+1 1b7:1:1:+db 1b8:2:4:+1 1c4:1:1:+2 1c5:1:1:+1 1c7:1:1:+2 1c8:1:1:+1 1ca:1:1:+2 1cb:9:2:+1\
  1de:9:2:+1 1f1:1:1:+2 1f2:2:2:+1 1f6:1:1:-61 1f7:1:1:-38 1f8:14:2:+1 220:1:1:-82 222:9:2:+1 23a:1:1:+2a2b\
  23b:1:1:+1 23d:1:1:-a3 23e:1:1:+2a28 241:1:1:+1 243:1:1:-c3 244:1:1:+45 245:1:1:+47 246:5:2:+1 345:1:1:+74\
  370:2:2:+1 376:1:1:+1 37f:1:1:+74 386:1:1:+26 388:3:1:+25 38c:1:1:+40 38e:2:1:+3f 391:11:1:+20 3a3:9:1:+20\
  3c2:1:1:+1 3cf:1:1:+8 3d0:1:1:-1e 3d1:1:1:-19 3d5:1:1:-f 3d6:1:1:-16 3d8:c:2:+1 3f0:1:1:-36 3f1:1:1:-30\
  3f4:1:1:-3c 3f5:1:1:-40 3f7:1:1:+1 3f9:1:1:-7 3fa:1:1:+1 3fd:3:1:-82 400:10:1:+50 410:20:1:+20 460:11:2:+1\
  48a:1b:2:+1 4c0:1:1:+f 4c1:7:2:+1 4d0:30:2:+1 531:26:1:+30 10a0:26:1:+1c60 10c7:2:6:+1c60 13f8:6:1:-8\
  1c80:1:1:-184e 1c81:1:1:-184d 1c82:1:1:-1844 1c83:2:1:-1842 1c85:1:1:-1843 1c86:1:1:-183c 1c87:1:1:-1824\
  1c88:1:1:+89c3 1c89:1:1:+1 1c90:2b:1:-bc0 1cbd:3:1:-bc0 1e00:4b:2:+1 1e9b:1:1:-3a 1ea0:30:2:+1 1f08:8:1:-8\
  1f18:6:1:-8 1f28:8:1:-8 1f38:8:1:-8 1f48:6:1:-8 1f59:4:2:-8 1f68:8:1:-8 1fb8:2:1:-8 1fba:2:1:-4a 1fbe:1:1:-1c05\
  1fc8:4:1:-56 1fd8:2:1:-8 1fda:2:1:-64 1fe8:2:1:-8 1fea:2:1:-70 1fec:1:1:-7 1ff8:2:1:-80 1ffa:2:1:-7e\
  2126:1:1:-1d5d 212a:1:1:-20bf 212b:1:1:-2046 2132:1:1:+1c 2160:10:1:+10 2183:1:1:+1 24b6:1a:1:+1a 2c00:30:1:+30\
  2c60:1:1:+1 2c62:1:1:-29f7 2c63:1:1:-ee6 2c64:1:1:-29e7 2c67:3:2:+1 2c6d:1:1:-2a1c 2c6e:1:1:-29fd 2c6f:1:1:-2a1f\
  2c70:1:1:-2a1e 2c72:2:3:+1 2c7e:2:1:-2a3f 2c80:32:2:+1 2ceb:2:2:+1 2cf2:2:794e:+1 a642:16:2:+1 a680:e:2:+1\
  a722:7:2:+1 a732:1f:2:+1 a779:2:2:+1 a77d:1:1:-8a04 a77e:5:2:+1 a78b:1:1:+1 a78d:1:1:-a528 a790:2:2:+1\
  a796:a:2:+1 a7aa:1:1:-a544 a7ab:1:1:-a54f a7ac:1:1:-a54b a7ad:1:1:-a541 a7ae:1:1:-a544 a7b0:1:1:-a512\
  a7b1:1:1:-a52a a7b2:1:1:-a515 a7b3:1:1:+3a0 a7b4:8:2:+1 a7c4:1:1:-30 a7c5:1:1:-a543 a7c6:1:1:-8a38 a7c7:2:2:+1\
  a7cb:1:1:-a567 a7cc:8:2:+1 a7dc:1:1:-a641 a7dd:2:5:-a566 a7f5:1:1:+1 ab6c:2:1:-21 ab70:50:1:-97d0 ff21:1a:1:+20\
  10400:28:1:+28 104b0:24:1:+28 10570:b:1:+27 1057c:f:1:+27 1058c:7:1:+27 10594:2:1:+27 10c80:33:1:+40\
  10d50:16:1:+20 118a0:20:1:+20 16e40:20:1:+20 16ea0:19:1:+1b 1df40:2:8:+1 1df4a:2:3:+1 1df51:2:17:+1 1df6a:3:2:+1\
  1df72:7:2:+1 1e900:22:1:+22'
const fullFoldings =
  'df=73,73 130=69,307 149=2bc,6e 1f0=6a,30c 390=3b9,308,301 3b0=3c5,308,301 587=565,582 1e96=68,331 1e97=74,308\
  1e98=77,30a 1e99=79,30a 1e9a=61,2be 1e9e=73,73 1f50=3c5,313 1f52=3c5,313,300 1f54=3c5,313,301 1f56=3c5,313,342\
  1f80=1f00,3b9 1f81=1f01,3b9 1f82=1f02,3b9 1f83=1f03,3b9 1f84=1f04,3b9 1f85=1f05,3b9 1f86=1f06,3b9 1f87=1f07,3b9\
  1f88=1f00,3b9 1f89=1f01,3b9 1f8a=1f02,3b9 1f8b=1f03,3b9 1f8c=1f04,3b9 1f8d=1f05,3b9 1f8e=1f06,3b9 1f8f=1f07,3b9\
  1f90=1f20,3b9 1f91=1f21,3b9 1f92=1f22,3b9 1f93=1f23,3b9 1f94=1f24,3b9 1f95=1f25,3b9 1f96=1f26,3b9 1f97=1f27,3b9\
  1f98=1f20,3b9 1f99=1f21,3b9 1f9a=1f22,3b9 1f9b=1f23,3b9 1f9c=1f24,3b9 1f9d=1f25,3b9 1f9e=1f26,3b9 1f9f=1f27,3b9\
  1fa0=1f60,3b9 1fa1=1f61,3b9 1fa2=1f62,3b9 1fa3=1f63,3b9 1fa4=1f64,3b9 1fa5=1f65,3b9 1fa6=1f66,3b9 1fa7=1f67,3b9\
  1fa8=1f60,3b9 1fa9=1f61,3b9 1faa=1f62,3b9 1fab=1f63,3b9 1fac=1f64,3b9 1fad=1f65,3b9 1fae=1f66,3b9 1faf=1f67,3b9\
  1fb2=1f70,3b9 1fb3=3b1,3b9 1fb4=3ac,3b9 1fb6=3b1,342 1fb7=3b1,342,3b9 1fbc=3b1,3b9 1fc2=1f74,3b9 1fc3=3b7,3b9\
  1fc4=3ae,3b9 1fc6=3b7,342 1fc7=3b7,342,3b9 1fcc=3b7,3b9 1fd2=3b9,308,300 1fd3=3b9,308,301 1fd6=3b9,342\
  1fd7=3b9,308,342 1fe2=3c5,308,300 1fe3=3c5,308,301 1fe4=3c1,313 1fe6=3c5,342 1fe7=3c5,308,342 1ff2=1f7c,3b9\
  1ff3=3c9,3b9 1ff4=3ce,3b9 1ff6=3c9,342 1ff7=3c9,342,3b9 1ffc=3c9,3b9 fb00=66,66 fb01=66,69 fb02=66,6c\
  fb03=66,66,69 fb04=66,66,6c fb05=73,74 fb06=73,74 fb13=574,576 fb14=574,565 fb15=574,56b fb16=57e,576\
  fb17=574,56d 1df95=73,73'

const foldings = new Map<string, string>()
for (const run of commonRuns.split(/\s+/)) {
  const [first = 0, count = 0, stride = 0, delta = 0] = run.split(':').map((field) => parseInt(field, 16))
  for (let index = 0; index < count; index++) {
    const from = first + index * stride
    foldings.set(String.fromCodePoint(from), String.fromCodePoint(from + delta))
  }
}
for (const folding of fullFoldings.split(/\s+/)) {
  const [from = '', to = ''] = folding.split('=')
  foldings.set(
    String.fromCodePoint(parseInt(from, 16)),
    to
      .split(',')
      .map((code) => String.fromCodePoint(parseInt(code, 16)))
      .join(''),
  )
}

export function foldCase(text: string): string {
  let folded = ''
  for (const character of text) folded += foldings.get(character) ?? character
  return folded
}
