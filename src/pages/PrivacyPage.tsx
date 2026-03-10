export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-16">
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Правовая информация</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            ПОЛИТИКА <span className="text-orange">КОНФИДЕНЦИАЛЬНОСТИ</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Обработка персональных данных в соответствии с ФЗ-152
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-invert max-w-none font-mono text-sm space-y-8">

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">1. ОБЩИЕ ПОЛОЖЕНИЯ</h2>
              <p className="text-muted-foreground leading-relaxed">
                Настоящая Политика конфиденциальности регулирует порядок обработки персональных данных
                пользователей автосервиса «Сервис-Точка» (далее — Оператор) в соответствии с
                Федеральным законом № 152-ФЗ от 27.07.2006 «О персональных данных».
              </p>
            </div>

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">2. ПЕРСОНАЛЬНЫЕ ДАННЫЕ</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Оператор обрабатывает следующие категории персональных данных:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Фамилия, имя, отчество</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Номер телефона</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Идентификационные данные автомобиля (VIN)</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Данные аккаунта Telegram (при использовании бота)</li>
              </ul>
            </div>

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">3. ЦЕЛИ ОБРАБОТКИ</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Запись на обслуживание автомобиля</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Уведомление о статусе ремонта</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Формирование документов (акт приёмки, заказ-наряд)</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Улучшение качества обслуживания</li>
              </ul>
            </div>

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">4. ЗАЩИТА ДАННЫХ (AES-256)</h2>
              <p className="text-muted-foreground leading-relaxed">
                Персональные данные (ФИО, телефон, VIN) хранятся в базе данных в зашифрованном виде
                с применением алгоритма <span className="text-orange">AES-256</span>. Доступ к данным
                ограничен и регистрируется в журнале аудита. Передача данных осуществляется по
                защищённому протоколу HTTPS.
              </p>
            </div>

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">5. ПРАВА СУБЪЕКТА</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                В соответствии со ст. 14-17 ФЗ-152, вы имеете право:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Получить информацию об обрабатываемых данных</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Потребовать уточнения, блокировки или уничтожения данных</li>
                <li className="flex items-start gap-2"><span className="text-orange">•</span> Отозвать согласие на обработку</li>
              </ul>
            </div>

            <div className="bg-surface border-2 border-border p-6">
              <h2 className="font-display text-3xl tracking-wider mb-4 text-orange">6. КОНТАКТЫ</h2>
              <p className="text-muted-foreground leading-relaxed">
                По вопросам обработки персональных данных обращайтесь:<br />
                <span className="text-foreground">Email: privacy@service-tochka.ru</span><br />
                <span className="text-foreground">Телефон: +7 (812) 123-45-67</span>
              </p>
            </div>

            <p className="font-mono text-xs text-muted-foreground text-center">
              Дата вступления в силу: 01 января 2024 г.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
