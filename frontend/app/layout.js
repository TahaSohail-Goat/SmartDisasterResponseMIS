import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'SDRMIS — Smart Disaster Response MIS',
  description: 'Smart Disaster Response Management Information System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
