import { Routes } from '@angular/router';
import { RegistrationForm } from './pages/registration-form/registration-form';
import { Admin } from './pages/admin/admin';

export const routes: Routes = [
    {path: '', component:RegistrationForm, title: 'Register | Iteen International Cup 2026'},
    {path: 'admin', component:Admin, title:'Admin | Iteen International Cup 2026'},
    {path: '**', redirectTo:''},
];
