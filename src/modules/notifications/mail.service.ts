import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_SMTP_PORT = 587;
const SECURE_SMTP_PORT = 465;
const DEFAULT_FROM = 'no-reply@localhost';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly smtpPass?: string;
  private readonly logOnly: boolean;

  constructor(config: ConfigService) {
    const enabled =
      config.get<string>('MAIL_ENABLED')?.trim().toLowerCase() === 'true';
    const host = config.get<string>('SMTP_HOST')?.trim();
    const from = config.get<string>('MAIL_FROM')?.trim();

    this.from = from || DEFAULT_FROM;
    this.logOnly = !enabled;

    if (this.logOnly) {
      this.transporter = createTransport({ jsonTransport: true });
      return;
    }

    if (!host)
      throw new Error('SMTP_HOST é obrigatório com MAIL_ENABLED=true.');
    if (!from)
      throw new Error('MAIL_FROM é obrigatório com MAIL_ENABLED=true.');

    const rawPort = config.get<string>('SMTP_PORT')?.trim();
    const port = rawPort ? Number(rawPort) : DEFAULT_SMTP_PORT;
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`SMTP_PORT inválido: ${rawPort}.`);
    }

    const user = config.get<string>('SMTP_USER')?.trim();
    this.smtpPass = config.get<string>('SMTP_PASS');

    this.transporter = createTransport({
      host,
      port,
      secure: port === SECURE_SMTP_PORT,
      ...(user ? { auth: { user, pass: this.smtpPass ?? '' } } : {}),
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...options });
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail: ${this.redact(error)}`);
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail agora.',
      );
    }

    if (this.logOnly) {
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.log(
        `E-mail não enviado (modo log): "${options.subject}" → ${to}`,
      );
    }
  }

  private redact(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return this.smtpPass ? message.split(this.smtpPass).join('***') : message;
  }
}
