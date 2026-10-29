import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

const sendMail = jest.fn();
const createTransport = nodemailer.createTransport as jest.Mock;

const mail = {
  to: 'a@x.com',
  subject: 'Assunto',
  html: '<p>oi</p>',
  text: 'oi',
};

const build = (env: Record<string, string>) =>
  new MailService(new ConfigService(env));

describe('MailService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    createTransport.mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({});
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('sem MAIL_ENABLED usa jsonTransport', async () => {
    const service = build({ MAIL_FROM: 'lei@citi.org.br' });
    expect(createTransport).toHaveBeenCalledWith({ jsonTransport: true });

    await service.send(mail);

    expect(sendMail).toHaveBeenCalledWith({ from: 'lei@citi.org.br', ...mail });
  });

  it('usa no-reply@localhost como remetente quando MAIL_FROM falta', async () => {
    await build({}).send(mail);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'no-reply@localhost' }),
    );
  });

  it('MAIL_ENABLED com variações de caixa sem SMTP_HOST lança erro', () => {
    expect(() =>
      build({ MAIL_ENABLED: ' TRUE ', MAIL_FROM: 'a@x.com' }),
    ).toThrow(/SMTP_HOST/);
  });

  it('SMTP ativo sem MAIL_FROM lança erro', () => {
    expect(() =>
      build({ MAIL_ENABLED: 'true', SMTP_HOST: 'smtp.x.com' }),
    ).toThrow(/MAIL_FROM/);
  });

  it('porta 465 usa secure true', () => {
    build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      SMTP_PORT: '465',
      MAIL_FROM: 'a@x.com',
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('porta 587 usa secure false', () => {
    build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      SMTP_PORT: '587',
      MAIL_FROM: 'a@x.com',
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it('porta ausente usa 587 e secure false', () => {
    build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      MAIL_FROM: 'a@x.com',
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it('SMTP_PORT não numérico lança erro', () => {
    expect(() =>
      build({
        MAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.x.com',
        SMTP_PORT: 'abc',
        MAIL_FROM: 'a@x.com',
      }),
    ).toThrow(/SMTP_PORT/);
  });

  it('sem SMTP_USER não envia o bloco auth', () => {
    build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      MAIL_FROM: 'a@x.com',
    });
    expect(createTransport.mock.calls[0][0]).not.toHaveProperty('auth');
  });

  it('com SMTP_USER e SMTP_PASS envia auth', () => {
    build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      MAIL_FROM: 'a@x.com',
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'user', pass: 'pass' } }),
    );
  });

  it('repassa a lista de destinatários sem alterar', async () => {
    const to = ['a@x.com', 'b@x.com'];
    await build({}).send({ ...mail, to });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to }));
  });

  it('falha de envio vira 503 sem vazar a senha', async () => {
    sendMail.mockRejectedValue(new Error('falha com senha-secreta'));
    const service = build({
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.x.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'senha-secreta',
      MAIL_FROM: 'a@x.com',
    });

    const error = await service.send(mail).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).not.toContain('senha-secreta');
    const logged = JSON.stringify(
      (Logger.prototype.error as jest.Mock).mock.calls,
    );
    expect(logged).not.toContain('senha-secreta');
  });
});
