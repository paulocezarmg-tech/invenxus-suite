import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { 
  Package, 
  Bell, 
  BarChart3, 
  ShoppingCart, 
  Truck, 
  Building2, 
  Users, 
  Check,
  MessageCircle,
  Menu,
  X,
  Star,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  ChevronDown,
  Play,
  TrendingUp,
  Clock,
  Award,
  HeartHandshake,
  Sparkles,
  Target,
  PieChart,
  FileText,
  Lock,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Instagram,
  Youtube
} from "lucide-react";
import gestaoEstoqueImg from "@/assets/gestao-de-estoque.jpg";

const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 }
};

const AnimatedSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const CountUp = ({ end, duration = 2, suffix = "" }: { end: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);
  
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const LandingPage = () => {
  const [typedText, setTypedText] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const fullText = "Controle, rapidez e precisão";
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  const testimonials = [
    {
      name: "Carlos Silva",
      role: "CEO, TechStore",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      content: "O StockMaster revolucionou nossa gestão de estoque. Reduzimos perdas em 40% no primeiro trimestre!",
      rating: 5
    },
    {
      name: "Ana Paula Mendes",
      role: "Gerente, Distribuidora Norte",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      content: "A facilidade de uso e os relatórios detalhados nos ajudam a tomar decisões mais rápidas e precisas.",
      rating: 5
    },
    {
      name: "Roberto Santos",
      role: "Diretor, IndústriaMax",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      content: "Integramos o sistema em 3 filiais e a sincronização é perfeita. Suporte excepcional!",
      rating: 5
    }
  ];

  const faqs = [
    {
      question: "Como funciona o período de teste?",
      answer: "Oferecemos 14 dias de teste gratuito com acesso completo a todas as funcionalidades. Não é necessário cartão de crédito para começar."
    },
    {
      question: "Posso importar meus dados de outro sistema?",
      answer: "Sim! Nossa equipe oferece suporte completo para migração de dados. Aceitamos arquivos CSV, Excel e integramos com os principais ERPs do mercado."
    },
    {
      question: "Quantos usuários posso ter no sistema?",
      answer: "O plano Premium inclui usuários ilimitados com controle de permissões granular. Você pode definir diferentes níveis de acesso para cada colaborador."
    },
    {
      question: "O sistema funciona offline?",
      answer: "O StockMaster é 100% na nuvem, garantindo que seus dados estejam sempre seguros e acessíveis de qualquer dispositivo com internet."
    },
    {
      question: "Como é feito o suporte técnico?",
      answer: "Oferecemos suporte prioritário via WhatsApp, email e chat. Nossa equipe está disponível de segunda a sexta, das 8h às 20h."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Cadastre seus Produtos",
      description: "Importe sua planilha ou cadastre manualmente seus produtos com código de barras, fotos e informações detalhadas.",
      icon: Package
    },
    {
      number: "02",
      title: "Configure Alertas",
      description: "Defina níveis mínimos de estoque e receba notificações automáticas quando for hora de repor.",
      icon: Bell
    },
    {
      number: "03",
      title: "Acompanhe em Tempo Real",
      description: "Visualize dashboards intuitivos, gere relatórios e tome decisões baseadas em dados precisos.",
      icon: BarChart3
    }
  ];

  const features = [
    {
      icon: Package,
      title: "Gestão Completa",
      description: "Cadastro de produtos, kits, entradas e saídas com histórico detalhado de todas as movimentações."
    },
    {
      icon: Bell,
      title: "Alertas Inteligentes",
      description: "Notificações automáticas sobre estoque baixo, vencimentos próximos e pontos de reposição."
    },
    {
      icon: BarChart3,
      title: "Relatórios e Insights",
      description: "Dashboards intuitivos, exportação em CSV e PDF, análises de performance e tendências."
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Dados criptografados, backups automáticos e controle de acesso por usuário."
    },
    {
      icon: Zap,
      title: "Integração Fácil",
      description: "Conecte com seu e-commerce, ERP ou sistema de vendas em poucos cliques."
    },
    {
      icon: Globe,
      title: "Acesso em Qualquer Lugar",
      description: "Sistema 100% na nuvem, acesse de qualquer dispositivo, a qualquer momento."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e6eef2] font-['Inter',sans-serif] overflow-x-hidden">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 z-[60] origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-900/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-[#0a0a0a]/90 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Stock<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Master</span></span>
            </motion.div>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {["Sobre", "Funcionalidades", "Como Funciona", "Depoimentos", "Plano", "FAQ"].map((item, i) => (
                <motion.button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase().replace(" ", "-"))}
                  className="text-sm text-white/70 hover:text-emerald-400 transition-colors relative group"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 group-hover:w-full transition-all duration-300" />
                </motion.button>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5">
                  Entrar
                </Button>
              </Link>
              <Button 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+falar+com+um+consultor!", "_blank")}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com Consultor
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <motion.nav 
              className="lg:hidden flex flex-col gap-4 mt-4 pb-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {["Sobre", "Funcionalidades", "Como Funciona", "Depoimentos", "Plano", "FAQ"].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase().replace(" ", "-"))}
                  className="text-left text-white/70 hover:text-emerald-400 transition-colors py-2"
                >
                  {item}
                </button>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                <Link to="/auth">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/5">
                    Entrar
                  </Button>
                </Link>
                <Button 
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                  onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Falar com Consultor
                </Button>
              </div>
            </motion.nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section id="sobre" className="relative pt-32 pb-20 px-4 min-h-screen flex items-center">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                Sistema #1 em Gestão de Estoque
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">{typedText}</span>
                <span className="animate-pulse text-emerald-400">|</span>
              </h1>
              
              <h2 className="text-2xl md:text-3xl font-medium text-white/80">
                Reduza perdas | Escale suas vendas
              </h2>
              
              <p className="text-lg text-white/60 leading-relaxed max-w-xl">
                Reduza perdas, ganhe agilidade e mantenha o controle total das suas operações com o StockMaster CMS — o sistema que transforma o gerenciamento de estoque em algo simples e inteligente.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-lg px-8 py-6 shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all group"
                  onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+assinar+o+StockMaster+CMS+Premium!", "_blank")}
                >
                  Começar Agora
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 font-semibold text-lg px-8 py-6 group"
                  onClick={() => scrollToSection("como-funciona")}
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Ver Como Funciona
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-white/50">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm">Dados 100% Seguros</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm">Suporte 24/7</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm">+500 Empresas</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-cyan-500/20 z-10" />
                <img 
                  src={gestaoEstoqueImg} 
                  alt="Gestão de Estoque Digital" 
                  className="w-full h-auto"
                />
              </div>
              
              {/* Floating Cards */}
              <motion.div
                className="absolute -bottom-6 -left-6 z-20"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Card className="bg-[#141414]/95 border-white/10 backdrop-blur-xl shadow-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/50">Crescimento</p>
                        <p className="text-2xl font-bold text-emerald-400">+127%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                className="absolute -top-4 -right-4 z-20"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Card className="bg-[#141414]/95 border-white/10 backdrop-blur-xl shadow-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-white/80">Estoque Atualizado</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-8 h-8 text-white/30" />
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/5 to-transparent" />
        <div className="container mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: 500, suffix: "+", label: "Empresas Ativas", icon: Building2 },
              { number: 2500000, suffix: "", label: "Itens Gerenciados", icon: Package },
              { number: 99.9, suffix: "%", label: "Uptime Garantido", icon: Shield },
              { number: 40, suffix: "%", label: "Redução de Perdas", icon: TrendingUp }
            ].map((stat, index) => (
              <AnimatedSection key={index}>
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
                    <stat.icon className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    <CountUp end={stat.number} suffix={stat.suffix} />
                  </div>
                  <p className="text-white/50 text-sm">{stat.label}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-24 px-4 relative">
        <div className="container mx-auto">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              Funcionalidades
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Tudo que você precisa em <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">um só lugar</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para transformar a gestão do seu estoque
            </p>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <AnimatedSection key={index}>
                <Card className="bg-[#141414]/80 border-white/5 hover:border-emerald-500/30 transition-all duration-500 group h-full hover:shadow-xl hover:shadow-emerald-500/5">
                  <CardContent className="p-8 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center group-hover:from-emerald-500/20 group-hover:to-teal-500/20 transition-all border border-emerald-500/10">
                      <feature.icon className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{feature.title}</h3>
                    <p className="text-white/60 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="como-funciona" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent" />
        <div className="container mx-auto relative">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              Como Funciona
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simples de usar, <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">poderoso de verdade</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Em apenas 3 passos você já estará no controle total do seu estoque
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-20 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-cyan-500/50" />
            
            {steps.map((step, index) => (
              <AnimatedSection key={index}>
                <div className="relative text-center space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-emerald-500/30 relative z-10">
                    {step.number}
                  </div>
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center">
                    <step.icon className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                  <p className="text-white/60 leading-relaxed">{step.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Video Demo Section */}
          <AnimatedSection className="mt-20">
            <div className="relative max-w-4xl mx-auto">
              <div 
                className="relative rounded-2xl overflow-hidden cursor-pointer group"
                onClick={() => setVideoModalOpen(true)}
              >
                {/* Video Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-[#141414] to-[#1a1a1a] border border-white/10 relative">
                  <img 
                    src={gestaoEstoqueImg}
                    alt="Demo do StockMaster"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                  />
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div 
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 group-hover:scale-110 transition-transform"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Play className="w-10 h-10 text-white ml-1" fill="white" />
                    </motion.div>
                  </div>
                  
                  {/* Video Info */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <Play className="w-3 h-3 mr-1" />
                        2:30 min
                      </Badge>
                      <span className="text-white/80 font-medium">Veja o StockMaster em ação</span>
                    </div>
                  </div>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl opacity-20 blur-xl group-hover:opacity-30 transition-opacity -z-10" />
              </div>
              
              <p className="text-center text-white/50 mt-6 text-sm">
                Clique para assistir a demonstração completa do sistema
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Video Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-5xl w-full p-0 bg-black border-white/10 overflow-hidden">
          <div className="aspect-video w-full">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
              title="Demo StockMaster"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Segments Section */}
      <section id="segmentos" className="py-24 px-4">
        <div className="container mx-auto">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              Segmentos
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perfeito para <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">todos os segmentos</span>
            </h2>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShoppingCart, title: "E-commerce", desc: "Sincronize seu estoque online e offline em tempo real" },
              { icon: Truck, title: "Distribuidoras", desc: "Controle de múltiplos depósitos e rastreamento" },
              { icon: Building2, title: "Indústrias", desc: "Gestão de matéria-prima e produtos acabados" },
              { icon: Users, title: "Representantes", desc: "Catálogo de produtos e controle de pedidos" }
            ].map((segment, index) => (
              <AnimatedSection key={index}>
                <Card className="bg-[#141414]/80 border-white/5 hover:border-emerald-500/30 transition-all duration-500 group hover:scale-105">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center group-hover:from-emerald-500/20 group-hover:to-teal-500/20 transition-all border border-emerald-500/10">
                      <segment.icon className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{segment.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed">{segment.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="depoimentos" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent" />
        <div className="container mx-auto relative">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              Depoimentos
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              O que nossos clientes <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">dizem</span>
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <AnimatedSection key={index}>
                <Card className="bg-[#141414]/80 border-white/5 hover:border-emerald-500/20 transition-all h-full">
                  <CardContent className="p-8 space-y-6">
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <p className="text-white/80 leading-relaxed italic">"{testimonial.content}"</p>
                    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/20"
                      />
                      <div>
                        <p className="font-semibold text-white">{testimonial.name}</p>
                        <p className="text-white/50 text-sm">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="plano" className="py-24 px-4 relative">
        <div className="container mx-auto max-w-5xl">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              Plano
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Invista no <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">crescimento</span> do seu negócio
            </h2>
            <p className="text-white/60 text-lg">Tudo que você precisa por um preço justo</p>
          </AnimatedSection>

          <AnimatedSection>
            <Card className="bg-gradient-to-br from-[#141414] to-[#1a1a1a] border-emerald-500/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl" />
              <CardContent className="p-8 md:p-12 relative">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      Mais Popular
                    </Badge>
                    <h3 className="text-3xl font-bold text-white">Plano Premium</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">R$89</span>
                      <span className="text-2xl text-white/50">,90/mês</span>
                    </div>
                    <p className="text-white/60">Cancele quando quiser. Sem fidelidade.</p>
                    <Button 
                      size="lg"
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-lg py-6 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all group"
                      onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+assinar+o+StockMaster+CMS+Premium!", "_blank")}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Começar Agora
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {[
                      "Produtos ilimitados",
                      "Usuários ilimitados",
                      "Relatórios e alertas automáticos",
                      "Exportação em CSV e PDF",
                      "Controle de permissões",
                      "Integrações com e-commerce",
                      "Suporte prioritário via WhatsApp",
                      "Atualizações contínuas",
                      "Backup automático diário"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-white/80">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent" />
        <div className="container mx-auto max-w-3xl relative">
          <AnimatedSection className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4">
              FAQ
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perguntas <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Frequentes</span>
            </h2>
          </AnimatedSection>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <AnimatedSection key={index}>
                <Card 
                  className={`bg-[#141414]/80 border-white/5 cursor-pointer transition-all ${openFaq === index ? 'border-emerald-500/30' : 'hover:border-white/10'}`}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white pr-4">{faq.question}</h3>
                      <ChevronDown className={`w-5 h-5 text-emerald-400 transition-transform flex-shrink-0 ${openFaq === index ? 'rotate-180' : ''}`} />
                    </div>
                    {openFaq === index && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-white/60 mt-4 leading-relaxed"
                      >
                        {faq.answer}
                      </motion.p>
                    )}
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto max-w-4xl">
          <AnimatedSection>
            <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 border-0 overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <CardContent className="p-12 md:p-16 text-center relative">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Pronto para transformar seu negócio?
                </h2>
                <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                  Junte-se a mais de 500 empresas que já revolucionaram sua gestão de estoque com o StockMaster
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg"
                    className="bg-white text-emerald-600 hover:bg-white/90 font-bold text-lg px-8 py-6 shadow-xl group"
                    onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                  >
                    Começar Gratuitamente
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 font-semibold text-lg px-8 py-6"
                    onClick={() => scrollToSection("plano")}
                  >
                    Ver Planos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="py-16 px-4 border-t border-white/5 bg-[#080808]">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Stock<span className="text-emerald-400">Master</span></span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                O sistema de gestão de estoque mais completo e intuitivo do mercado.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                  <Linkedin className="w-5 h-5 text-white/70 hover:text-emerald-400" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                  <Instagram className="w-5 h-5 text-white/70 hover:text-emerald-400" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                  <Youtube className="w-5 h-5 text-white/70 hover:text-emerald-400" />
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-white">Produto</h4>
              <ul className="space-y-2">
                {["Funcionalidades", "Integrações", "Preços", "Atualizações"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-white">Empresa</h4>
              <ul className="space-y-2">
                {["Sobre Nós", "Blog", "Carreiras", "Parceiros"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-white">Contato</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-white/50 text-sm">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  contato@stockmaster.com.br
                </li>
                <li className="flex items-center gap-3 text-white/50 text-sm">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  (11) 99999-9999
                </li>
                <li className="flex items-center gap-3 text-white/50 text-sm">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  São Paulo, SP
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © 2025 StockMaster CMS — Desenvolvido por <span className="text-emerald-400 font-medium">Paulo Cézar</span>
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">Termos de Uso</a>
              <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">Política de Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
