import {UseCase} from "../../../../shared/core/UseCase";
import {CreateUserDto} from "./create_user_dto";
import {CreateUserResponse} from "./create_user_response";
import {IAuthRepo} from "../../repos/i_auth_repo";
import {ProductUser} from "../../domain/entity/product_user";
import {
    UserEmail,
    UserName,
    UserNationalId,
    UserPassword,
    UserPhoneNumber
} from "../../domain/value_object/value_object";
import {CreateUserError} from "./create_user_error";
import {left, Result, right} from "../../../../shared/core/Result";
import {AppError} from "../../../../shared/core/AppError";
import {UserProfile} from "../../domain/entity/user_profile";
import {AuthService} from "../../services/auth_service";

export class CreateUserUseCase implements UseCase<CreateUserDto,
    Promise<CreateUserResponse>> {
    private authRepo: IAuthRepo;
    private authService: AuthService;

    constructor(authRepo: IAuthRepo,
                authService: AuthService) {
        this.authRepo = authRepo;
        this.authService = authService;
    }

    async execute(request?: CreateUserDto
    ): Promise<CreateUserResponse> {
        const userDomain = ProductUser.create({
            email: UserEmail.create({value: request.email}),
            password: UserPassword.create(
                {
                    value: request.password,
                    hashed: false
                }
            )
        });

        if (userDomain.isFailure) {
            return left(
                new CreateUserError.ValuePropsError(userDomain),
            );
        }

        const profileDomain = UserProfile.create({
            email: UserEmail.create({value: request.email}),
            firstName: UserName.create({value: request.firstName}),
            lastName: UserName.create({value: request.lastName}),
            phone: UserPhoneNumber.create({value: request.phone}),
            nationalId: UserNationalId.create({value: request.nationalId}),
            location: request.location,
            avatar: '',
        })

        if (profileDomain.isFailure) {
            return left(
                new CreateUserError.ValuePropsError(profileDomain)
            );
        }

        try {
            const exists = await this.authRepo.exists(request.email);
            if (exists) {
                return left(
                    new CreateUserError.EmailAlreadyExist(request.email)
                );
            }

            let user = userDomain.getValue();
            let profile = profileDomain.getValue();
            user.userCreated(profile)
            await this.authRepo.saveUser(user);
            const token = await this.authService.signJWT({
                email: user.email.getValue().value,
                userId: user.id.toValue() as string,
            });
            return right(Result.ok<any>({
                token: token,
                message: 'User created successfully'
            }));
        } catch (e) {
            return left(
                new AppError.UnexpectedError(e)
            ) as CreateUserResponse;
        }
    }

}