import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  X
} from "lucide-react";
import gestaoEstoqueImg from "@/assets/gestao-de-estoque.jpg";

const LandingPage = () => {
  const [typedText, setTypedText] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fullText = "Controle, rapidez e precisão";

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

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white font-['Poppins',sans-serif]">
      {/* Background Effect */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0b0b0b] to-[#0b0b0b] pointer-events-none" />
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-[#0b0b0b]/95 backdrop-blur-sm z-50 border-b border-emerald-500/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-8 h-8 text-[#00d48e]" />
              <span className="text-2xl font-bold">StockMaster <span className="text-[#00d48e]">CMS</span></span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => scrollToSection("sobre")} className="hover:text-[#00d48e] transition-colors">Sobre</button>
              <button onClick={() => scrollToSection("funcionalidades")} className="hover:text-[#00d48e] transition-colors">Funcionalidades</button>
              <button onClick={() => scrollToSection("segmentos")} className="hover:text-[#00d48e] transition-colors">Segmentos</button>
              <button onClick={() => scrollToSection("plano")} className="hover:text-[#00d48e] transition-colors">Plano</button>
              <button onClick={() => scrollToSection("contato")} className="hover:text-[#00d48e] transition-colors">Contato</button>
            </nav>

            <Button 
              className="hidden md:flex bg-[#00d48e] hover:bg-[#00b37e] text-black font-semibold"
              onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+falar+com+um+consultor!", "_blank")}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Falar com Consultor
            </Button>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden flex flex-col gap-4 mt-4 pb-4">
              <button onClick={() => scrollToSection("sobre")} className="text-left hover:text-[#00d48e] transition-colors">Sobre</button>
              <button onClick={() => scrollToSection("funcionalidades")} className="text-left hover:text-[#00d48e] transition-colors">Funcionalidades</button>
              <button onClick={() => scrollToSection("segmentos")} className="text-left hover:text-[#00d48e] transition-colors">Segmentos</button>
              <button onClick={() => scrollToSection("plano")} className="text-left hover:text-[#00d48e] transition-colors">Plano</button>
              <button onClick={() => scrollToSection("contato")} className="text-left hover:text-[#00d48e] transition-colors">Contato</button>
              <Button 
                className="bg-[#00d48e] hover:bg-[#00b37e] text-black font-semibold w-full"
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+falar+com+um+consultor!", "_blank")}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com Consultor
              </Button>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section id="sobre" className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                <span className="text-[#00d48e]">{typedText}</span>
                <span className="animate-pulse">|</span>
              </h1>
              <h2 className="text-2xl md:text-4xl font-semibold">
                Reduza perdas | Escale suas vendas
              </h2>
              <p className="text-lg text-gray-300">
                Reduza perdas, ganhe agilidade e mantenha o controle total das suas operações com o StockMaster CMS — o sistema que transforma o gerenciamento de estoque em algo simples e inteligente.
              </p>
              <Button 
                size="lg"
                className="bg-[#00d48e] hover:bg-[#00b37e] text-black font-bold text-lg px-8 py-6 shadow-[0_0_20px_rgba(0,212,142,0.3)] hover:shadow-[0_0_30px_rgba(0,212,142,0.5)] transition-all"
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+assinar+o+StockMaster+CMS+Premium!", "_blank")}
              >
                💼 Assine Agora — R$89,90/mês
              </Button>
            </div>

            <div className="relative">
              <img 
                src={gestaoEstoqueImg} 
                alt="Gestão de Estoque Digital" 
                className="rounded-lg shadow-2xl border border-emerald-500/20"
              />
              <Card className="absolute -bottom-6 -left-6 bg-[#0b0b0b]/95 border-emerald-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#00d48e] rounded-full animate-pulse" />
                    <div>
                      <p className="text-sm text-gray-400">Estoque Atual</p>
                      <p className="text-2xl font-bold text-[#00d48e]">1.256 itens</p>
                      <p className="text-xs text-gray-500">cadastrados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 px-4 bg-gradient-to-b from-transparent to-emerald-950/10">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Funcionalidades <span className="text-[#00d48e]">Poderosas</span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:shadow-[0_0_30px_rgba(0,212,142,0.2)] group">
              <CardContent className="p-8 space-y-4">
                <div className="w-16 h-16 bg-[#00d48e]/10 rounded-lg flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <Package className="w-8 h-8 text-[#00d48e]" />
                </div>
                <h3 className="text-2xl font-bold">Gestão Completa</h3>
                <p className="text-gray-400">
                  Cadastro de produtos, kits, entradas e saídas com histórico detalhado de todas as movimentações.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:shadow-[0_0_30px_rgba(0,212,142,0.2)] group">
              <CardContent className="p-8 space-y-4">
                <div className="w-16 h-16 bg-[#00d48e]/10 rounded-lg flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <Bell className="w-8 h-8 text-[#00d48e]" />
                </div>
                <h3 className="text-2xl font-bold">Alertas Inteligentes</h3>
                <p className="text-gray-400">
                  Notificações automáticas sobre estoque baixo, vencimentos próximos e pontos de reposição.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:shadow-[0_0_30px_rgba(0,212,142,0.2)] group">
              <CardContent className="p-8 space-y-4">
                <div className="w-16 h-16 bg-[#00d48e]/10 rounded-lg flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <BarChart3 className="w-8 h-8 text-[#00d48e]" />
                </div>
                <h3 className="text-2xl font-bold">Relatórios e Insights</h3>
                <p className="text-gray-400">
                  Dashboards intuitivos, exportação em CSV e PDF, análises de performance e tendências.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section id="segmentos" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Perfeito para <span className="text-[#00d48e]">Todos os Segmentos</span>
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:scale-105 group">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-[#00d48e]/10 rounded-full flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <ShoppingCart className="w-10 h-10 text-[#00d48e]" />
                </div>
                <h3 className="text-xl font-bold">E-commerce</h3>
                <p className="text-gray-400 text-sm">
                  Sincronize seu estoque online e offline em tempo real
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:scale-105 group">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-[#00d48e]/10 rounded-full flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <Truck className="w-10 h-10 text-[#00d48e]" />
                </div>
                <h3 className="text-xl font-bold">Distribuidoras</h3>
                <p className="text-gray-400 text-sm">
                  Controle de múltiplos depósitos e rastreamento de entregas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:scale-105 group">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-[#00d48e]/10 rounded-full flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <Building2 className="w-10 h-10 text-[#00d48e]" />
                </div>
                <h3 className="text-xl font-bold">Indústrias</h3>
                <p className="text-gray-400 text-sm">
                  Gestão de matéria-prima, produção e produtos acabados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b]/50 border-emerald-500/20 hover:border-[#00d48e] transition-all hover:scale-105 group">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-[#00d48e]/10 rounded-full flex items-center justify-center group-hover:bg-[#00d48e]/20 transition-colors">
                  <Users className="w-10 h-10 text-[#00d48e]" />
                </div>
                <h3 className="text-xl font-bold">Representantes</h3>
                <p className="text-gray-400 text-sm">
                  Catálogo de produtos e controle de pedidos em campo
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Plano Premium */}
      <section id="plano" className="py-20 px-4 bg-gradient-to-b from-emerald-950/10 to-transparent">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Plano <span className="text-[#00d48e]">Premium</span>
            </h2>
            <p className="text-gray-400 text-lg">Tudo que você precisa para gerenciar seu estoque</p>
          </div>

          <Card className="bg-[#0b0b0b]/80 border-[#00d48e] shadow-[0_0_50px_rgba(0,212,142,0.2)]">
            <CardContent className="p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="text-5xl md:text-7xl font-bold text-[#00d48e] mb-2">R$89,90</div>
                <div className="text-gray-400 text-xl">/mês</div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Relatórios e alertas automáticos</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Exportação de dados em CSV e PDF</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Multiusuário com controle de permissões</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Integração com plataformas de e-commerce</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Suporte prioritário via WhatsApp</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00d48e] flex-shrink-0 mt-1" />
                  <span className="text-lg">Atualizações e melhorias contínuas</span>
                </div>
              </div>

              <Button 
                size="lg"
                className="w-full bg-[#00d48e] hover:bg-[#00b37e] text-black font-bold text-xl py-6 shadow-[0_0_30px_rgba(0,212,142,0.4)] hover:shadow-[0_0_50px_rgba(0,212,142,0.6)] transition-all"
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá,+quero+assinar+o+StockMaster+CMS+Premium!", "_blank")}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar com Consultor
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="py-8 px-4 border-t border-emerald-500/10">
        <div className="container mx-auto text-center">
          <p className="text-gray-400">
            © 2025 StockMaster CMS — Desenvolvido por <span className="text-[#00d48e]">Paulo Cézar</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;