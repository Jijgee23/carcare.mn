// ConfirmForm-оор дуудагдах server action-ийн үр дүн. Хүлээгдэж буй алдааг
// throw хийвэл production-д мессеж нь нуугдаж error хуудас руу унадаг тул
// `{ error }` буцааж, ConfirmForm toast-оор харуулна.
export type ConfirmActionResult = void | { error: string };
