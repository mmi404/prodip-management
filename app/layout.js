import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'প্রদীপ (Prodip) · স্বপ্ন বুননের একটি পথচলা',
  description: 'Prodip Volunteer Management System (PVMS) for CUET',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
