import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Users, Compass, Wind, Layers, Maximize2 } from 'lucide-react';
import { ModuleItem } from '../types';
import { MODULES } from '../data';

interface ModuleExplorerProps {
  isDark: boolean;
}

export default function ModuleExplorer({ isDark }: ModuleExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedModule, setSelectedModule] = useState<ModuleItem>(MODULES[0]);

  const categories = ['All', 'Stats & Goals', 'API Hidden'];

  const filteredModules = selectedCategory === 'All' 
    ? MODULES 
    : MODULES.filter(m => m.category === selectedCategory);

  const handleModuleSelect = (module: ModuleItem) => {
    setSelectedModule(module);
  };

  return (
    <section 
      id="voyages" 
      className={`py-24 px-4 md:px-8 lg:px-16 transition-colors duration-500 ${
        isDark ? 'bg-[color:var(--os-s1)] border-t border-border-color/30' : 'bg-stone-100 border-t border-border-color/40'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        
        {/* Section Heading */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.65 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
        >
          <div>
            <span className={`text-xs font-bold tracking-widest uppercase mb-2 block ${
              isDark ? 'text-accent-purple' : 'text-text-secondary'
            }`}>
              Возможности расширения
            </span>
            <h2 className={`text-3xl md:text-5xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-text-primary'
            }`}>
              Обзор модулей myJournal
            </h2>
            <p className={`mt-2 text-sm md:text-base max-w-xl ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
              Тщательно разработанные скрипты и коннекторы, оптимизированные для быстрой интеграции с дневником TOP Academy и удобной работы с учебными данными.
            </p>
          </div>

          {/* Categories Tab Pill Selector */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-full self-start md:self-end backdrop-blur-md border border-border-color" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgb(var(--os-fg-rgb) / 0.8)'
          }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  const matched = cat === 'All' ? MODULES[0] : MODULES.find(m => m.category === cat);
                  if (matched) setSelectedModule(matched);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? isDark 
                      ? 'bg-[color:var(--os-fg)] text-bg-dark shadow' 
                      : 'bg-gradient-to-r from-[#30ff44] to-[#00ffc2] text-black shadow'
                    : isDark 
                      ? 'text-text-secondary hover:text-white' 
                      : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content Layout: Master-Detail Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          
          {/* Left Side: Module Cards List (4 columns) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 mb-1 ${isDark ? 'text-text-dim' : 'text-text-dim'}`}>
              Доступные компоненты ({filteredModules.length})
            </span>
            {filteredModules.map((module) => {
              const isCurrent = selectedModule.id === module.id;
              return (
                <button
                  key={module.id}
                  onClick={() => handleModuleSelect(module)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                    isCurrent
                      ? isDark
                        ? 'bg-bg-card border-white/20 shadow-xl shadow-black/20 text-white'
                        : 'bg-[color:var(--os-fg)] border-accent-purple/20 shadow-lg text-text-primary'
                      : isDark
                        ? 'bg-bg-card/30 border-border-color hover:bg-bg-card/70 text-text-secondary hover:text-white'
                        : 'bg-white/40 border-border-color hover:bg-white/80 text-text-secondary hover:text-text-primary shadow-sm'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] tracking-wider uppercase opacity-60 font-mono">
                      {module.category}
                    </span>
                    <span className="font-semibold text-sm md:text-base tracking-tight">
                      {module.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block opacity-60">Ресурс</span>
                    <span className="font-bold font-mono text-xs text-accent-purple-muted">
                      {module.accuracy}% OK
                    </span>
                  </div>
                </button>
              );
            })}

            <div className={`p-4 rounded-2xl border flex items-start gap-3 mt-4 ${
              isDark ? 'bg-bg-dark/40 border-border-color' : 'bg-bg-card/60 border-border-color'
            }`}>
              <ShieldAlert className="w-5 h-5 text-accent-purple shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-text-dim">
                Все запросы к учебному порталу полностью безопасны. Ваша сессия дневника находится под надёжной защитой.
              </p>
            </div>
          </div>

          {/* Right Side: Module Details Panel (8 columns) */}
          <div className="lg:col-span-8">
            <div className={`rounded-3xl border overflow-hidden p-6 md:p-8 transition-all ${
              isDark ? 'bg-bg-card border-border-color/60 shadow-2xl' : 'bg-[color:var(--os-fg)] border-border-color shadow-xl'
            }`}>
              
              {/* Image Layer */}
              <div className="relative rounded-2xl overflow-hidden h-64 md:h-80 w-full mb-6 group bg-black/10">
                <img 
                  src={selectedModule.imageUrl} 
                  alt={selectedModule.name} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-semibold tracking-wider uppercase">
                  {selectedModule.category} Component
                </div>
                <div className="absolute bottom-4 right-4 bg-[color:var(--os-bg)]/80 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-xs font-mono font-medium">
                  {selectedModule.loadRate}
                </div>
              </div>

              {/* Title & Description */}
              <div className="mb-6">
                <h3 className={`text-2xl md:text-3xl font-bold tracking-tight mb-2 ${
                  isDark ? 'text-white' : 'text-text-primary'
                }`}>
                  {selectedModule.name}
                </h3>
                <p className={`text-sm md:text-base leading-relaxed font-light ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  {selectedModule.description}
                </p>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {selectedModule.metrics ? (
                  selectedModule.metrics.map((metric, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-xl text-center border ${
                        isDark ? 'bg-bg-dark/50 border-border-color/40' : 'bg-stone-50 border-border-color'
                      }`}
                    >
                      {metric.icon === 'users' && <Users className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />}
                      {metric.icon === 'compass' && <Compass className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />}
                      {metric.icon === 'wind' && <Wind className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />}
                      {metric.icon === 'layers' && <Layers className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />}
                      <span className="text-[10px] uppercase font-semibold text-text-dim block mb-0.5">
                        {metric.label}
                      </span>
                      <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-text-primary'}`}>
                        {metric.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className={`p-4 rounded-xl text-center border ${
                      isDark ? 'bg-bg-dark/50 border-border-color/40' : 'bg-stone-50 border-border-color'
                    }`}>
                      <Users className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />
                      <span className="text-[10px] uppercase font-semibold text-text-dim block mb-0.5">Лимиты</span>
                      <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-text-primary'}`}>
                        {selectedModule.loadRate.split(' ')[0]} {selectedModule.loadRate.split(' ')[1]}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl text-center border bg-bg-dark/50 border-border-color/40" style={{
                      backgroundColor: isDark ? 'var(--bg-dark)' : 'var(--bg-card)'
                    }}>
                      <Compass className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />
                      <span className="text-[10px] uppercase font-semibold text-text-dim block mb-0.5">Точность</span>
                      <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-text-primary'}`}>
                        {selectedModule.accuracy}% расчёты
                      </span>
                    </div>

                    <div className="p-4 rounded-xl text-center border bg-bg-dark/50 border-border-color/40" style={{
                      backgroundColor: isDark ? 'var(--bg-dark)' : 'var(--bg-card)'
                    }}>
                      <Wind className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />
                      <span className="text-[10px] uppercase font-semibold text-text-dim block mb-0.5">Скорость</span>
                      <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-text-primary'}`}>
                        {selectedModule.speed}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl text-center border bg-bg-dark/50 border-border-color/40" style={{
                      backgroundColor: isDark ? 'var(--bg-dark)' : 'var(--bg-card)'
                    }}>
                      <Layers className="w-4 h-4 text-accent-purple mx-auto mb-1.5" />
                      <span className="text-[10px] uppercase font-semibold text-text-dim block mb-0.5">Хранилище</span>
                      <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-text-primary'}`}>
                        {selectedModule.storageLimit}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Technical Specifications */}
              <div className={`p-5 rounded-2xl flex flex-col md:flex-row gap-6 md:items-center justify-between border ${
                isDark ? 'bg-bg-dark/30 border-border-color/40' : 'bg-stone-50 border-border-color'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <Maximize2 className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold uppercase ${isDark ? 'text-white' : 'text-text-primary'}`}>
                      Технические свойства
                    </h4>
                    <p className="text-[11px] text-text-dim">Спецификации и интеграционные протоколы</p>
                  </div>
                </div>

                <div className="flex gap-6 items-center flex-wrap md:flex-nowrap">
                  {selectedModule.specs ? (
                    selectedModule.specs.map((spec, specIdx) => (
                      <div key={specIdx} className="flex items-center gap-6">
                        {specIdx > 0 && <div className="border-l border-border-color h-6 hidden md:block"></div>}
                        <div>
                          <span className="text-[10px] text-text-dim uppercase block font-medium">
                            {spec.label}
                          </span>
                          <span className={`font-semibold font-mono text-xs ${isDark ? 'text-white' : 'text-text-primary'}`}>
                            {spec.value}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div>
                        <span className="text-[10px] text-text-dim uppercase block font-medium">Платформа</span>
                        <span className={`font-semibold font-mono text-xs ${isDark ? 'text-white' : 'text-text-primary'}`}>{selectedModule.cabinHeight.split(' / ')[0]}</span>
                      </div>
                      <div className="border-l border-border-color h-6"></div>
                      <div>
                        <span className="text-[10px] text-text-dim uppercase block font-medium">Формат</span>
                        <span className={`font-semibold font-mono text-xs ${isDark ? 'text-white' : 'text-text-primary'}`}>{selectedModule.cabinWidth.split(' ')[0]}</span>
                      </div>
                      <div className="border-l border-border-color h-6"></div>
                      <div>
                        <span className="text-[10px] text-text-dim uppercase block font-medium">Протоколы</span>
                        <span className="font-semibold text-xs text-violet-500">Интеграция по API</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

        </motion.div>

      </div>
    </section>
  );
}
