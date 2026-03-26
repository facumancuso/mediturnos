'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Skeleton } from './ui/skeleton';
import Image from 'next/image';

export function ProfileQrCode() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    // This ensures we get the full, absolute URL on the client-side
    setUrl(window.location.href);
  }, []);

  if (!url) {
    // Show a skeleton loader while waiting for the URL to be available on the client
    // Adjusted size to match the container with padding
    return <Skeleton className="h-[144px] w-[144px]" />;
  }
  
  const qrCodeSize = 128;
  const logoSize = 28;

  return (
    <div className="p-2 border rounded-md bg-white inline-block">
        <div style={{ position: 'relative', width: qrCodeSize, height: qrCodeSize }}>
            <QRCode 
                value={url} 
                size={qrCodeSize} 
                bgColor={"#ffffff"} 
                fgColor={"#000000"} 
                level={"H"} // Use High error correction to ensure scannability with a logo
            />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'white',
                padding: '2px', // Small border around logo
                borderRadius: '4px',
            }}>
                <Image 
                    src="/logo.svg" 
                    alt="MediTurnos Logo" 
                    width={logoSize} 
                    height={logoSize}
                />
            </div>
        </div>
    </div>
  );
}
