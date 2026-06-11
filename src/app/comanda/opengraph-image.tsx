import { ImageResponse } from 'next/og'

export const alt = 'Zmeurel — Precomenzi Zmeură 2026'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

const heroUrl = new URL('/shop/shop-hero-zmeura.jpg', 'https://comanda.zmeurel.ro').toString()

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#312E3F',
          color: '#FFFFFF',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'linear-gradient(180deg, rgba(49,46,63,0.08) 20%, rgba(49,46,63,0.92) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 64,
            right: 64,
            bottom: 54,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 28,
              fontWeight: 700,
              color: '#FFB1AA',
            }}
          >
            <span
              style={{
                display: 'flex',
                width: 18,
                height: 18,
                borderRadius: 999,
                background: '#F16B6B',
              }}
            />
            Zmeurel · Văratec, Suceava
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 980,
              fontSize: 66,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            Precomenzi Zmeură 2026
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 600,
              color: '#FFF6F3',
            }}
          >
            Zmeură proaspătă, culeasă în ziua livrării
          </div>
        </div>
      </div>
    ),
    size,
  )
}
