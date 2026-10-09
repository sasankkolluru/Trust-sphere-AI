declare module "pdf-parse" {
  type PDFData = {
    text: string;
    numpages: number;
  };

  function parse(data: Buffer): Promise<PDFData>;
  export default parse;
}
