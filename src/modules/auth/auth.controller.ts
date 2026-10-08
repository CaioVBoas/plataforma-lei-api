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
import { LoginDto } from './dto/login.dto';
import { RegisterPartnerDto } from './dto/registerPartner.dto';
import { RegisterProfessorDto } from './dto/registerProfessor.dto';
import { RegisterStudentDto } from './dto/registerStudent.dto';
import { JwtAuthGuard } from './guards/jwtAuth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
