import struct, sys, zlib

def png(path, n):
    s = n / 512.0
    dots = [(x, y, i < 4) for i, (y, x) in enumerate((y, x) for y in (160, 256, 352) for x in (160, 256, 352))]
    r = 34 * s
    rows = bytearray()
    for py in range(n):
        rows.append(0)
        for px in range(n):
            v = 0.0
            for (cx, cy, dim) in dots:
                d = ((px + .5 - cx * s) ** 2 + (py + .5 - cy * s) ** 2) ** .5
                a = min(1.0, max(0.0, r - d + .5))
                if a > 0:
                    v = a * (42 if dim else 244)
                    break
            rows += bytes((int(v),) * 3)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))

out = sys.argv[1]
for n in (180, 192, 512):
    png(f'{out}/icon-{n}.png', n)
print('ok')
