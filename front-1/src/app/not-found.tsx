import Link from 'next/link'
import { Dumbbell } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#fffb00] mb-8">
        <Dumbbell className="h-8 w-8 text-black" />
      </div>

      <p className="text-[#fffb00] text-xs font-bold uppercase tracking-widest mb-4">Error 404</p>

      <h1 className="text-5xl font-black text-white tracking-tight mb-3">
        Página no encontrada
      </h1>

      <p className="text-white/40 text-sm max-w-sm mb-10">
        La página que buscás no existe o fue movida.
      </p>

      <Link
        href="/login"
        className="rounded-xl bg-[#fffb00] px-6 py-3 text-sm font-black text-black hover:bg-yellow-300 transition-all active:scale-[0.98]"
      >
        Iniciar sesión
      </Link>
    </div>
  )
}
