const MOCK_MESSAGES = [
    {
        id: 1,
        sender: "أحمد (طالب)",
        receiver: "الأستاذ محمد",
        text: "شكراً يا أستاذ على شرح درس الرياضيات اليوم، كان رائعاً جداً!",
        timestamp: "10:30 AM",
        status: "approved",
        likes: 5,
        reactions: ["❤️", "👍"]
    },
    {
        id: 2,
        sender: "أم سارة",
        receiver: "المعلمة فاطمة",
        text: "ممتنة جداً لاهتمامك بسارة وتشجيعها المستمر.",
        timestamp: "11:15 AM",
        status: "approved",
        likes: 12,
        reactions: ["🌸"]
    },
    {
        id: 3,
        sender: "المدير",
        receiver: "الطلاب",
        text: "فخور جداً بنظافة الساحة اليوم. أنتم رائعون!",
        timestamp: "09:00 AM",
        status: "approved",
        likes: 45,
        reactions: ["👏", "⭐"]
    },
    {
        id: 4,
        sender: "خالد (طالب)",
        receiver: "الأستاذ علي",
        text: "لم أفهم الدرس جيداً، لكن شكراً لمحاولتك.",
        timestamp: "08:45 AM",
        status: "pending", // Waiting for approval
        likes: 0,
        reactions: []
    }
];

// Export if using modules, but for simple vanilla JS we'll just expose it globally or use this file to init localStorage
if (!localStorage.getItem('gratitude_messages')) {
    localStorage.setItem('gratitude_messages', JSON.stringify(MOCK_MESSAGES));
}
