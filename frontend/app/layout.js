import './globals.css';
import Providers from './providers';
import StarCanvas from './components/StarCanvas';

export const metadata = {
  title: 'SDRMIS — Smart Disaster Response MIS',
  description: 'Smart Disaster Response Management Information System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <StarCanvas />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
