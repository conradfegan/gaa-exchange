import Image from 'next/image'
import logo from '@/public/logo.png'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Image
        src={logo}
        alt="GAA Exchange"
        height={36}
        className="mb-6"
      />
      <p className="mt-2 text-gray-500">Buy and sell GAA jerseys.</p>
    </div>
  )
}
