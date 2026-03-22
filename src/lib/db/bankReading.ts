// ==========================================
// LINGUALEARN - LOT 2 : Banque Lecture
// EN (6 textes: 1/niveau A1-B2 + 2 GRC) + ES (2 textes A1-A2)
// ==========================================

import { ReadingText } from './bankTypes';

export const BANK_READING: ReadingText[] = [
  // ===== ANGLAIS - TRAVEL - A1 =====
  { id:'rd_en_01', language:'en', level:'A1', theme:'travel', title:'My First Trip',
    body_text:`I am going on a trip. I have my passport and my suitcase. I take a taxi to the airport. The airport is very big. I check in and get my boarding pass. I wait at the gate. The plane is ready. I find my seat. The flight is two hours. I am happy. I arrive at the hotel. The room is nice. I am tired but excited. Tomorrow I will explore the city. I want to see the beach and the old town. I have a map. This is a great trip.` },

  // ===== ANGLAIS - TRAVEL - A2 =====
  { id:'rd_en_02', language:'en', level:'A2', theme:'travel', title:'A Weekend in Barcelona',
    body_text:`Last weekend, I went to Barcelona with my friend. We took a flight from Paris. The flight was only two hours. We arrived at the airport and took a bus to the city center. Our hotel was near Las Ramblas, a famous street with many shops and restaurants. On Saturday, we visited the Sagrada Familia. It is a beautiful church designed by Gaudí. We also walked around the Gothic Quarter and tried some tapas. The food was delicious. On Sunday, we went to the beach. The weather was warm and sunny. We swam in the sea and relaxed on the sand. In the evening, we had dinner at a small restaurant near the port. I ordered paella. It was the best paella I have ever tasted. We came back to Paris on Sunday night. It was a short but wonderful trip.` },

  // ===== ANGLAIS - TRAVEL - B1 =====
  { id:'rd_en_03', language:'en', level:'B1', theme:'travel', title:'Backpacking Through Southeast Asia',
    body_text:`After finishing university, I decided to go backpacking through Southeast Asia for three months. I started in Thailand, where I spent two weeks exploring Bangkok and the northern city of Chiang Mai. The temples were breathtaking, and the street food was incredibly cheap and delicious. From Thailand, I traveled by bus to Cambodia to visit Angkor Wat. Watching the sunrise over the ancient temples was one of the most memorable experiences of my life. Next, I flew to Vietnam and traveled from north to south. I loved the chaos of Hanoi and the beauty of Ha Long Bay. The overnight train from Hanoi to Hue was an adventure in itself. I met travelers from all over the world, and we shared stories and travel tips. One thing I learned is that traveling slowly allows you to really understand a culture. Instead of rushing from one tourist attraction to another, I spent time in local markets, talked to people, and tried to learn a few words in each language. Backpacking taught me independence, flexibility, and the importance of stepping outside my comfort zone.` },

  // ===== ANGLAIS - TRAVEL - B2 =====
  { id:'rd_en_04', language:'en', level:'B2', theme:'travel', title:'The Ethics of Modern Tourism',
    body_text:`Tourism is one of the largest industries in the world, contributing significantly to global GDP and providing employment for millions of people. However, the rapid growth of mass tourism has raised serious ethical and environmental concerns. Overtourism in cities like Venice, Barcelona, and Dubrovnik has led to rising housing costs, environmental degradation, and a loss of local character. Residents in these cities have staged protests against the influx of tourists, arguing that their quality of life has deteriorated. Sustainable tourism offers an alternative approach. It emphasizes minimizing environmental impact, supporting local economies, and respecting cultural heritage. Eco-lodges, community-based tourism, and carbon offset programs are examples of initiatives that aim to make travel more responsible. Critics argue, however, that sustainable tourism remains a niche market that does not address the systemic issues of the industry. The COVID-19 pandemic provided an unexpected opportunity to rethink tourism. With international travel severely restricted, many destinations experienced a period of environmental recovery. As the world reopens, the challenge is to rebuild the tourism industry in a way that balances economic growth with environmental sustainability and social equity.` },

  // ===== ANGLAIS - GRC (MEETINGS/RISK) - B1 =====
  { id:'rd_en_05', language:'en', level:'B1', theme:'meetings', title:'How to Run an Effective Meeting',
    body_text:`Meetings are an essential part of professional life, but they are often criticized for being unproductive. According to several studies, the average professional spends about 15 hours per week in meetings, and nearly 70% of those meetings are considered unnecessary or poorly organized. So how can we make meetings more effective? First, every meeting should have a clear agenda distributed in advance. This allows participants to prepare and ensures that the discussion stays focused. The agenda should include the topics to be discussed, the time allocated for each topic, and the expected outcomes. Second, the meeting should have a designated facilitator who keeps the conversation on track and ensures that everyone has a chance to speak. Third, action items should be clearly defined at the end of the meeting, with specific responsibilities and deadlines assigned to individuals. Finally, meeting notes or minutes should be shared with all participants within 24 hours. By following these simple guidelines, organizations can reduce meeting time by up to 30% while improving the quality of decisions made.` },

  // ===== ANGLAIS - GRC (RISK) - B2 =====
  { id:'rd_en_06', language:'en', level:'B2', theme:'risk', title:'Enterprise Risk Management in the Digital Age',
    body_text:`Enterprise Risk Management (ERM) has evolved significantly over the past two decades. What was once a compliance-driven exercise focused primarily on financial and operational risks has become a strategic discipline that encompasses cyber threats, reputational risks, and emerging challenges such as climate change and geopolitical instability. The COSO framework, updated in 2017, provides a comprehensive approach to ERM that integrates risk management with strategy and performance. It emphasizes the importance of risk culture, governance, and the alignment of risk appetite with organizational objectives. In the digital age, cybersecurity has become one of the most critical risk categories. The average cost of a data breach exceeded $4 million in 2023, and ransomware attacks have increased by over 150% in the past three years. Organizations must implement robust controls, including multi-factor authentication, encryption, and regular penetration testing. The three lines of defense model remains a cornerstone of effective risk governance. The first line consists of operational management, which owns and manages risks on a daily basis. The second line provides oversight through risk management and compliance functions. The third line offers independent assurance through internal audit. As risks become more interconnected and complex, organizations that invest in proactive risk management will be better positioned to navigate uncertainty and create sustainable value.` },

  // ===== ESPAGNOL - TRAVEL - A1 =====
  { id:'rd_es_01', language:'es', level:'A1', theme:'travel', title:'Mi primer viaje',
    body_text:`Voy a hacer un viaje. Tengo mi pasaporte y mi maleta. Tomo un taxi al aeropuerto. El aeropuerto es muy grande. Hago el registro y recibo mi tarjeta de embarque. Espero en la puerta. El avión está listo. Encuentro mi asiento. El vuelo es de dos horas. Estoy contento. Llego al hotel. La habitación es bonita. Estoy cansado pero emocionado. Mañana voy a explorar la ciudad. Quiero ver la playa y el centro histórico. Tengo un mapa. Es un viaje muy bonito.` },

  // ===== ESPAGNOL - TRAVEL - A2 =====
  { id:'rd_es_02', language:'es', level:'A2', theme:'travel', title:'Un fin de semana en Madrid',
    body_text:`El fin de semana pasado, fui a Madrid con mi amiga. Tomamos un vuelo desde París. El vuelo fue de solo dos horas. Llegamos al aeropuerto y tomamos el metro al centro de la ciudad. Nuestro hotel estaba cerca de la Puerta del Sol, una plaza famosa con muchas tiendas y restaurantes. El sábado, visitamos el Museo del Prado. Es un museo muy grande con pinturas increíbles. También caminamos por el Parque del Retiro y comimos churros con chocolate. La comida estaba deliciosa. El domingo, fuimos al mercado de San Miguel. Probamos tapas y vinos españoles. Por la noche, cenamos en un restaurante pequeño. Pedí una tortilla española. Fue la mejor tortilla que he probado. Volvimos a París el domingo por la noche. Fue un viaje corto pero maravilloso.` },

  // ===== ESPAGNOL - TRAVEL - A2 (Additional) =====
  { id:'rd_es_03', language:'es', level:'A2', theme:'travel', title:'Viajando en tren',
    body_text:`El tren es una forma muy popular de viajar en Europa. Es cómodo, rápido y no muy caro. El mes pasado tomé un tren desde París hasta Barcelona. El viaje fue de ocho horas. La estación de tren es muy grande y moderna. Hay tiendas, restaurantes y cafeterías en la estación. Mi asiento estaba en el vagón número tres. Pude ver el paisaje hermoso durante el viaje. El tren pasó por montañas, pueblos pequeños y ciudades grandes. Compré un café en la cafetería del tren. Cuando llegué a Barcelona, la ciudad era muy bonita. Recomiendo viajar en tren si tienes tiempo.` },

  // ===== ESPAGNOL - TRAVEL - A2 (Additional 2) =====
  { id:'rd_es_04', language:'es', level:'A2', theme:'travel', title:'En el aeropuerto',
    body_text:`Cuando viajas en avión, debes llegar al aeropuerto dos horas antes del vuelo. Primero, necesitas hacer la cola en el mostrador de facturación. Allí, el agente revisa tu pasaporte y tu boleto. Luego, debes pasar por el control de seguridad. Los guardias revisan tu equipaje de mano. Después, puedes ir a la sala de espera. En la sala de espera hay muchas tiendas y restaurantes. Puedes comprar souvenires, libros y comida. También hay baños públicos y teléfonos. Cuando anuncian tu vuelo, debes ir a la puerta de embarque. Allí, un agente te pide tu tarjeta de embarque. Entonces, subes al avión y encuentras tu asiento. El viaje en avión es emocionante y cansador al mismo tiempo.` },

  // ===== ANGLAIS - MEETINGS - A2 =====
  { id:'rd_en_07', language:'en', level:'A2', theme:'meetings', title:'Planning a Team Meeting',
    body_text:`Organizing a successful team meeting requires careful planning. First, decide on the purpose of the meeting. Is it to discuss a project, solve a problem, or share information? Second, send an invitation to all participants at least one week in advance. Include the date, time, location, and agenda. Third, prepare any documents or presentations you will need. Send them to participants before the meeting so they can prepare. On the day of the meeting, arrive early to set up the room. Make sure the equipment works properly. During the meeting, stick to the agenda and manage the time carefully. After the meeting, send a summary to all participants. Include the decisions made and the action items assigned. Good meeting management helps teams work more efficiently.` },

  // ===== ANGLAIS - TRAVEL - A1 (Additional) =====
  { id:'rd_en_08', language:'en', level:'A1', theme:'travel', title:'Packing for a Trip',
    body_text:`When you go on a trip, you need to pack your suitcase carefully. First, think about the weather. If it is hot, pack light clothes. If it is cold, pack warm clothes. Second, pack comfortable shoes for walking. You will do a lot of walking when you travel. Third, pack important documents like your passport and airline ticket. Put them in a safe place. Fourth, pack toiletries like a toothbrush and toothpaste. You can also pack medicine if you need it. Fifth, pack a camera to take photos. Do not forget your phone charger. Pack your suitcase about two days before you leave. Do not pack too many things. Try to pack light. A heavy suitcase is not fun to carry.` },

  // ===== ANGLAIS - TRAVEL - A1 (Additional 2) =====
  { id:'rd_en_09', language:'en', level:'A1', theme:'travel', title:'My First Trip',
    body_text:`Last summer, I went to London for the first time. I took the train from Paris. The journey was three hours long. I stayed in a small hotel near the city center. I visited Big Ben and the Tower of London. The weather was cloudy but warm. I ate fish and chips for lunch. It was delicious! I want to go back next year.` },

  // ===== ANGLAIS - DAILY_LIFE - A1 =====
  { id:'rd_en_10', language:'en', level:'A1', theme:'daily_life', title:'A Day at School',
    body_text:`I wake up at seven every morning. I eat breakfast with my family. Then I walk to school. My favorite class is English. The teacher is very kind. After school, I play football with my friends. In the evening, I do my homework and read a book. I go to bed at nine.` },

  // ===== ANGLAIS - BUSINESS - A2 =====
  { id:'rd_en_11', language:'en', level:'A2', theme:'business', title:'The Job Interview',
    body_text:`Yesterday I had a job interview at a marketing company. I woke up early and wore my best suit. The office was on the tenth floor of a modern building. The interviewer asked about my experience and skills. I talked about my previous job and my university degree. She seemed impressed by my presentation skills. I felt nervous but confident. They will call me next week with the result.` },

  // ===== ANGLAIS - DAILY_LIFE - A1 (Additional) =====
  { id:'rd_en_12', language:'en', level:'A1', theme:'daily_life', title:'Shopping for Groceries',
    body_text:`Every Saturday, I go to the supermarket. I make a list before I leave home. I buy bread, milk, eggs, and fruit. Sometimes I buy cheese and chicken too. The supermarket is near my house. I walk there in ten minutes. I pay with my card. The total is usually about thirty euros.` },

  // ===== ESPAGNOL - TRAVEL - A1 (Additional) =====
  { id:'rd_es_05', language:'es', level:'A1', theme:'travel', title:'Mi Viaje a Barcelona',
    body_text:`El verano pasado fui a Barcelona con mi familia. Viajamos en avión desde París. Barcelona es una ciudad muy bonita. Visitamos la Sagrada Familia y el Parque Güell. La playa era fantástica. Comimos paella y tapas. El tiempo era soleado y caluroso. Quiero volver el próximo año.` },

  // ===== ESPAGNOL - DAILY_LIFE - A1 =====
  { id:'rd_es_06', language:'es', level:'A1', theme:'daily_life', title:'Un Día Normal',
    body_text:`Me despierto a las siete de la mañana. Desayuno café con tostadas. Voy al trabajo en metro. Trabajo en una oficina pequeña. A mediodía como con mis compañeros. Por la tarde hago ejercicio en el gimnasio. Por la noche ceno con mi familia y vemos una película. Me acuesto a las once.` },

  // ===== ANGLAIS - FAMILY - A1 =====
  { id:'rd_en_13', language:'en', level:'A1', theme:'family', title:'My Family',
    body_text:`My name is Emma. I have a family of five people. My father is named James. He is a businessman. My mother is named Sarah. She is a teacher. I have two brothers named Tom and Jack. Tom is twelve years old and Jack is nine. I am fourteen years old. I love my family very much. My parents are kind and loving. My brothers are funny and friendly. We spend time together every weekend. We like to go to the park and play games. On Sundays, we have a big family dinner. My grandmother and grandfather sometimes visit us. We are a happy family.` },

  { id:'rd_en_14', language:'en', level:'A1', theme:'family', title:'A Family Dinner',
    body_text:`It is Saturday evening and the family is preparing for dinner. Father is cooking in the kitchen. Mother is setting the table with plates and glasses. My sister is preparing a salad. My brother is making the dessert. I am helping to arrange the chairs. Grandmother and Grandfather are sitting in the living room. They are talking about the old days. The baby is playing with toys on the floor. Soon, the food is ready. Everyone comes to the dinner table. We hold hands and say thank you for the meal. The roasted chicken is delicious. The vegetables are fresh and tasty. Grandfather tells funny stories. We all laugh together. The chocolate cake for dessert is amazing. After dinner, the family plays card games. It is a wonderful evening with my family.` },

  { id:'rd_en_15', language:'en', level:'A1', theme:'family', title:'My Grandparents',
    body_text:`I love my grandparents very much. My grandfather is eighty years old. His name is Robert. He is tall and strong for his age. He has white hair and kind blue eyes. My grandmother is seventy-eight years old. Her name is Margaret. She is warm and gentle. She has silver hair and a beautiful smile. My grandparents have been married for fifty years. They live in a small house by the sea. My grandfather enjoys fishing and gardening. My grandmother loves to cook and bake. She makes the best apple pie. They have four children and ten grandchildren. My grandparents are the heart of our family. They tell us stories about the old days. We visit them every month. They teach us about love, patience, and respect. I hope they live for many more years.` },
];
