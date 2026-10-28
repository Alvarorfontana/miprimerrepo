// Configuración del Observatorio.
// Para que las seccionales carguen datos desde la web, creá un proyecto gratuito en supabase.com,
// corré docs/supabase.sql y pegá acá la URL y la clave pública "anon" (es pública por diseño;
// la seguridad la dan las reglas de acceso definidas en el SQL).
// Si quedan vacías, el portal funciona en modo lectura con los archivos de /data.
window.OBSERVATORIO = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
