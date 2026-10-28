import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto, UserResponseDto } from './dto/authResponse.dto';
import { CodeSentDto } from './dto/codeSent.dto';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/passwordReset.dto';
import { RegisterPartnerDto } from './dto/registerPartner.dto';
import { RegisterProfessorDto } from './dto/registerProfessor.dto';
import { RegisterStudentDto } from './dto/registerStudent.dto';
import { JwtAuthGuard } from './guards/jwtAuth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/professor/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar dados do docente e gerar código de verificação',
  })
  @ApiResponse({ status: 200, type: CodeSentDto })
  requestProfessorSignupCode(
    @Body() dto: RegisterProfessorDto,
  ): Promise<CodeSentDto> {
    return this.authService.requestProfessorSignupCode(dto);
  }

  @Post('register/partner/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar dados do parceiro e gerar código de verificação',
  })
  @ApiResponse({ status: 200, type: CodeSentDto })
  requestPartnerSignupCode(
    @Body() dto: RegisterPartnerDto,
  ): Promise<CodeSentDto> {
    return this.authService.requestPartnerSignupCode(dto);
  }

  @Post('password-reset/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar código de recuperação de senha' })
  @ApiResponse({ status: 200, type: CodeSentDto })
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<CodeSentDto> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redefinir senha com código de verificação' })
  @ApiResponse({ status: 204, description: 'Senha redefinida' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }

  @Post('register/student')
  @ApiOperation({ summary: 'Registrar estudante' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({
    status: 409,
    description: 'E-mail ou matrícula já cadastrada',
  })
  registerStudent(@Body() dto: RegisterStudentDto): Promise<AuthResponseDto> {
    return this.authService.registerStudent(dto);
  }

  @Post('register/professor')
  @ApiOperation({ summary: 'Registrar docente' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  registerProfessor(
    @Body() dto: RegisterProfessorDto,
  ): Promise<AuthResponseDto> {
    return this.authService.registerProfessor(dto);
  }

  @Post('register/partner')
  @ApiOperation({ summary: 'Registrar parceiro' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  registerPartner(@Body() dto: RegisterPartnerDto): Promise<AuthResponseDto> {
    return this.authService.registerPartner(dto);
  }

  // NestJS devolve 201 por padrão em POST; o contrato do frontend exige 200.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  me(@CurrentUser() user: { userId: string }): Promise<UserResponseDto> {
    // O usuário vem do `sub` do token, nunca de parâmetro do cliente.
    return this.authService.me(user.userId);
  }
}
