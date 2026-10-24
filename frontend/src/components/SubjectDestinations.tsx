import { motion } from 'motion/react';
import { SUBJECTS } from '../data';
import { SubjectItem } from '../types';
import { BookOpen, Compass, ArrowRight } from 'lucide-react';

interface SubjectDestinationsProps {
  isDark: boolean;
  onSelectSubject: (subjectName: string) => void;
  onContactSupport: () => void;
}

export default function SubjectDestinations({ isDark, onSelectSubject, onContactSupport }: SubjectDestinationsProps) {
  return (
    <section 
      id="worlds" 
      className={`py-24 px-4 md:px-8 lg:px-16 transition-colors duration-500 ${
        isDark ? 'bg-[color:var(--os-bg)] text-white' : 'bg-[color:var(--os-fg)] text-gray-900'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        
        {/* Section Title */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className={`text-xs font-bold tracking-widest uppercase mb-2.5 block ${
            isDark ? 'text-accent-purple' : 'text-text-secondary'
          }`}>
            Полное покрытие предметов
          </span>
          <h2 className={`text-3xl md:text-5xl font-bold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-text-primary'
          }`}>
            Предметы
          </h2>
          <p className={`text-sm md:text-base leading-relaxed ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
            Ключевые направления программирования, по которым ведутся занятия, домашние задания и учёт успеваемости.
          </p>
        </div>

        {/* Destination Bento-Style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SUBJECTS.map((sub, idx) => {
            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.65 }}
                transition={{ duration: 1.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, scale: 1.015 }}
                className={`group rounded-3xl overflow-hidden border transition-[background-color,border-color,box-shadow] duration-300 flex flex-col h-[460px] ${
                  isDark 
                    ? 'bg-[color:var(--os-s1)]/60 border-border-color hover:border-accent-purple/45 hover:shadow-2xl hover:shadow-black/50' 
                    : 'bg-stone-50 border-border-color hover:bg-[color:var(--os-fg)] hover:shadow-xl hover:border-accent-purple/30 shadow-sm'
                }`}
              >
                {/* Image Layer */}
                <div className="relative h-56 w-full overflow-hidden bg-slate-900">
                  <img 
                    src={sub.imageUrl} 
                    alt={sub.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-mono tracking-wider font-semibold">
                    {sub.code} MODULE
                  </div>
                  <div className="absolute bottom-4 left-4 bg-[color:var(--os-bg)]/80 backdrop-blur-sm px-3 py-1 rounded-lg text-white text-xs font-medium flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-accent-purple" />
                    {sub.area}
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-6 flex flex-col justify-between flex-grow">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-bold tracking-tight ${
                        isDark ? 'text-white' : 'text-text-primary'
                      }`}>
                        {sub.name}
                      </h3>
                      <span className="text-xs font-mono text-text-dim font-medium">
                        Сложность: {sub.complexity}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-accent-purple-muted tracking-wide font-mono">
                      {sub.shortQuote}
                    </span>
                    <p className={`text-xs md:text-sm mt-1 leading-relaxed line-clamp-3 ${
                      isDark ? 'text-text-secondary' : 'text-text-secondary'
                    }`}>
                      {sub.description}
                    </p>
                  </div>

                  {/* Select button */}
                  <button
                    onClick={() => onSelectSubject(sub.name)}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer border ${
                      isDark 
                        ? 'bg-transparent text-white border-white/10 hover:bg-[color:var(--os-fg)] hover:text-[color:var(--os-bg)] hover:border-white' 
                        : 'bg-transparent text-text-primary border-border-color hover:bg-gradient-to-r from-[#30ff44] to-[#00ffc2] hover:text-black hover:border-accent-purple'
                    }`}
                  >
                    Выбрать для симулятора
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Support Banner */}
        <div className={`mt-16 p-8 rounded-3xl border flex flex-col md:flex-row items-center gap-6 justify-between ${
          isDark 
            ? 'bg-gradient-to-r from-[color:var(--os-s1)] to-[color:var(--os-bg)] border-border-color' 
            : 'bg-gradient-to-r from-stone-50 to-white border-border-color shadow-sm'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isDark ? 'bg-white/5 text-accent-purple' : 'bg-accent-purple/5 text-accent-purple'}`}>
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h4 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-text-primary'}`}>
                Не нашли нужный предмет в списке или у вас дипломная работа?
              </h4>
              <p className="text-xs text-text-dim max-w-md mt-0.5">
                Свяжитесь с поддержкой в Telegram. Мы поможем настроить журнал под вашу группу или требования вашего куратора.
              </p>
            </div>
          </div>

          <button
            onClick={onContactSupport}
            className={`px-6 py-3.5 rounded-xl text-xs font-semibold tracking-widest uppercase whitespace-nowrap hover:opacity-90 transition-all cursor-pointer ${
              isDark ? 'bg-white text-bg-dark' : 'bg-gradient-to-r from-[#30ff44] to-[#00ffc2] text-black'
            }`}
          >
            Связаться с поддержкой
          </button>
        </div>

      </div>
    </section>
  );
}
